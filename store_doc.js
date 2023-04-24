'use strict';

//vendor
const escapeStringRegexp = require('escape-string-regexp');
const moment = require('moment');
const dayjs = require('dayjs');
const _ = require('lodash');
const Boom = require('boom');
const Joi = require('joi');
const joinjs = require('join-js').default;


//own
const {
  TO_DB,
  JOIN_PREFIX,
  TO_DB_WITH_PREFIX,
} = require('../constants/models/store_doc/fields_map');
const {
  TO_DB: DOC_PRODUCT_TO_DB,
  JOIN_PREFIX: DOC_PRODUCT_JOIN_PREFIX,
  TO_DB_WITH_PREFIX: DOC_PRODUCT_TO_DB_WITH_PREFIX,
} = require('../constants/models/store_doc_product/fields_map');
const {
  TO_DB: DOC_SERVICE_TO_DB,
  JOIN_PREFIX: DOC_SERVICE_JOIN_PREFIX,
  TO_DB_WITH_PREFIX: DOC_SERVICE_TO_DB_WITH_PREFIX,
} = require('../constants/models/store_doc_service/fields');
const {
  TO_DB: PRODUCT_TO_DB,
  JOIN_PREFIX: PRODUCT_JOIN_PREFIX,
  TO_DB_WITH_PREFIX: PRODUCT_TO_DB_WITH_PREFIX,
} = require('./../constants/models/store_product/fields_map');
const {
  TO_DB: BUSINESS_SUPPLIER_TO_DB,
  JOIN_PREFIX: BUSINESS_SUPPLIER_JOIN_PREFIX,
  TO_DB_WITH_PREFIX: BUSINESS_SUPPLIER_TO_DB_WITH_PREFIX,
} = require('./../constants/models/business_supplier/fields_map');
const {
  TO_DB: MANAGER_TO_DB,
  JOIN_PREFIX: MANAGER_JOIN_PREFIX,
  TO_DB_WITH_PREFIX: MANAGER_TO_DB_WITH_PREFIX,
} = require('./../constants/models/manager/fields_map');

const {
  TO_DB: BRAND_TO_DB,
  JOIN_PREFIX: BRAND_JOIN_PREFIX,
  TO_DB_WITH_PREFIX: BRAND_TO_DB_WITH_PREFIX,
} = require('./../constants/models/appurtenancies_brand/fields_map');

const TYPES = require('../constants/models/store_doc/types');
const CONTEXTS = require('../constants/models/store_doc/contexts');
const STATUSES = require('../constants/models/store_doc/statuses');
const DOCUMENT_TYPES = require('../constants/models/store_doc/document_types');
const ORDER_DOCUMENT_TYPES = require('../constants/models/store_doc/order_document_types');
const ATTRIBUTES = require('../constants/models/warehouses/attributes');
const configProxyMap = require('../components/config').get('proxyMap');
const OPERATIONS = {
  UPDATE: 'UPDATE',
}
let resDocument, quantityRes = null;

const { ADMIN, UPDATE_SUCCESS_ORDER } = require('../constants/grants');

const createScheme = require('../validations/routes/create_store_doc_scheme');
const { convert } = require('../helpers/models/model_utils');
const { result, add } = require('lodash');
const round = (x) => {
  return Math.round(x * 100) / 100;
}

const paidSum = (storeDocId) => {
  return `(
    select
      coalesce((round(
        (sum(coalesce(cor_increase, 0)) - sum(coalesce(cor_decrease, 0)))::numeric, 2)
      )::float, 0)
    from cash_orders_tbl
    where cor_std_id_fk = ${storeDocId}
  )`;
}
const docPaidSumNegative = () => {
  return `(
    select
    sum(coalesce(debt_amount_left, 0))
    from debts_tbl
    where debt_related_doc = std_operation_code ||'-'|| std_bsn_id_fk ||'-'|| std_id_pk and debt_sign_col = '-'
  )`;
}
const docPaidSumPositive = () => {
  return `(
    select
    sum(coalesce(debt_amount_left, 0))
    from debts_tbl
    where debt_related_doc = std_operation_code ||'-'|| std_bsn_id_fk ||'-'|| std_id_pk and debt_sign_col = '+'
  )`;
}

const docPaidSumDone = () => {
  return `(
    select
    debt_amount_left
    from debts_tbl
    where debt_related_doc = std_operation_code ||'-'|| std_bsn_id_fk ||'-'|| std_id_pk and debt_doctype != 'CSH' ORDER BY debt_related_doc DESC LIMIT 1
  )`;
}


/** Get query for calculating remaining sum of a store doc
  * Алгоритм НДС в складских док-тах:
  * 1. В INCOME документ увеличивается на Ставку% НДС из реквизитов, когда у ПОСТАВЩИК выбраны реквизиты с НДС.
  * 2. В EXPENSE документ увеличивается на Ставку% НДС из реквизитов, когда у СТО выбраны реквизиты с НДС.
  * 3. Исключение - возвраты SRT и CRT. 
  *     У возврата поставщику (SRT), документ увеличивается на Ставку%, если выбран ПОСТАВЩИК с реквизитами НДС.
  *     У возврата от клиента (CRT), документ увеличивается на Ставку%, если выбрано СТО с реквизитами НДС.
  * 4. При этом у SRT документов реквизиты СТО не влияют на НДС. 
  *   У CRT реквизиты клиента не влияют на НДС.
  * @returns query
*/
const remainingSumQuery = () => {
  return `(
    round(coalesce((
      case 
        when std_type = 'INCOME' AND std_document_type = 'CLIENT' then
          abs(std_sum) 
          * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
          + ${paidSum('std_id_pk', 'std_document_type')}

        when std_type = 'EXPENSE' AND std_document_type = 'CLIENT' then
          abs(std_selling_sum) 
          * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
          - ${paidSum('std_id_pk', 'std_document_type')}
        
        when std_type = 'EXPENSE' AND std_document_type = 'SUPPLIER' then
          abs(std_selling_sum) 
          * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
          - ${paidSum('std_id_pk', 'std_document_type')}

        when std_type = 'INCOME' then
            abs(std_sum) 
            * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
            + ${paidSum('std_id_pk', 'std_document_type')}
        
        when std_type = 'EXPENSE' then
            abs(std_sum) 
            * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
            + ${paidSum('std_id_pk', 'std_document_type')}

        else 0
      end
    ), 0)::numeric, 2)::float
  )`;
};

/**
 * Get query for calculating sum of a store doc including taxes
 * @returns query
 */
const sumWithTaxQuery = () => {
  return `(
    round(coalesce((
      case 
          when std_type = 'INCOME' AND std_document_type = 'CLIENT' then
              abs(std_sum) 
              * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)

          when std_type = 'INCOME' AND std_document_type = 'CLIENT' AND std_operation_code = 'CRA' then
              abs(std_sum) 
              * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
  
          when std_type = 'EXPENSE' AND std_document_type = 'CLIENT' then
              (case when (std_operation_code = 'AUT') then 
                abs(std_sum) 
                * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
              else
                abs(std_sum) 
                * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
              end)
          
          when std_type = 'EXPENSE' AND std_document_type = 'SUPPLIER' then
            abs(std_sum) 
            * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)

          when std_type = 'EXPENSE' and std_document_type = 'ADJUSTMENT' then
              abs(std_sum) 
              * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)

          when std_type = 'EXPENSE' AND std_document_type = 'OWN_CONSUMPTION' then
              (case when (std_operation_code = 'CST') then 
                abs(std_sum)
              else
                abs(std_sum) 
                * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
              end) 

          when std_type = 'EXPENSE' AND std_document_type = 'TRANSFER' then
              abs(std_sum)
  
          when std_type = 'INCOME' then
              abs(std_sum) 
              * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
          
          when std_type = 'EXPENSE' then
                (case when (std_operation_code = 'STM') then 
                abs(std_sum)
              else
                abs(std_sum) 
                * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
              end)
          else 0
      end
    ), 0)::numeric, 2)::float
  )`;
};

/**
 * Returns value for store doc: на фронті якщо ця змінна true то показується також сумма з пдв
 * @returns query
 */
const showTaxQuery = () => {
  return `(
    case 
      when std_type = 'INCOME' AND std_document_type = 'CLIENT' then
        (case when rqt_is_tax_payer IS TRUE then true else false end)

      when std_type = 'EXPENSE' AND std_document_type = 'CLIENT' then
        (case when rqt_is_tax_payer IS TRUE then true else false end)
      
      when std_type = 'EXPENSE' AND std_document_type = 'SUPPLIER' then
        (case when bsr_is_tax_payer IS TRUE then true else false end)

      when std_type = 'INCOME' AND std_document_type = 'SUPPLIER' AND std_operation_code = 'ORD' then
        (case when bsr_is_tax_payer IS TRUE then true else false end)

      when std_type = 'INCOME' then
        (case when bsr_is_tax_payer IS TRUE then true else false end)

      when std_type = 'EXPENSE' and std_document_type = 'ADJUSTMENT' then
        (case when bsr_is_tax_payer IS TRUE then true else false end)
      
      when std_type = 'EXPENSE' then
        (case when rqt_is_tax_payer IS TRUE then true else false end)
      else false
    end
  )`;
};

const MAPS = [
  {
    mapId: 'storeDocListMap',
    idProperty: 'id',
    properties: Object.keys(TO_DB),
    associations: [
      {
        name: 'businessSupplier',
        mapId: 'businessSupplierMap',
        columnPrefix: BUSINESS_SUPPLIER_JOIN_PREFIX,
      },
      {
        name: 'manager',
        mapId: 'managerMap',
        columnPrefix: MANAGER_JOIN_PREFIX,
      },
    ],
  },
  {
    mapId: 'storeDocMap',
    idProperty: 'id',
    properties: [...Object.keys(TO_DB), ...[
        'warehouseName',
        'counterpartBusinessSupplierName',
        'counterpartClientName',
        'counterpartClientPhones',
        'counterpartWarehouseName',
        'counterpartEmployeeName',
        'documentNumber',
        'barcode',
        'remainSum',
        'sumTax',
        'showTax',
        'sellingSumTax',
        'sellingSum',
        'wrhAttribute',
        'counterpartWhsAttribute',
        'incomeOnlyWithCell',
        'ordNum',
      ]],
    associations: [
      {
        name: 'businessSupplier',
        mapId: 'businessSupplierMap',
        columnPrefix: BUSINESS_SUPPLIER_JOIN_PREFIX,
      },
      {
        name: 'manager',
        mapId: 'managerMap',
        columnPrefix: MANAGER_JOIN_PREFIX,
      },
    ],
    collections: [
      {
        name: 'docProducts',
        mapId: 'docProductMap',
        columnPrefix: DOC_PRODUCT_JOIN_PREFIX,
      },
      {
        name: 'docServices',
        mapId: 'docServiceMap',
        columnPrefix: DOC_SERVICE_JOIN_PREFIX,
      },
    ],
  },
  {
    mapId: 'docProductMap',
    idProperty: 'id',
    properties: [ 'orderId', 'orderNum', ...Object.keys(DOC_PRODUCT_TO_DB) ],
    associations: [
      {
        name: 'product',
        mapId: 'productMap',
        columnPrefix: PRODUCT_JOIN_PREFIX,
      },
    ],
  },
  {
    mapId: 'productMap',
    idProperty: 'id',
    properties: Object.keys(PRODUCT_TO_DB),
    associations: [
      {
        name: 'brand',
        mapId: 'brandMap',
        columnPrefix: BRAND_JOIN_PREFIX,
      },
    ],
  },
  {
    mapId: 'businessSupplierMap',
    idProperty: 'id',
    properties: Object.keys(BUSINESS_SUPPLIER_TO_DB),
  },
  {
    mapId: 'managerMap',
    idProperty: 'id',
    properties: Object.keys(MANAGER_TO_DB),
  },
  {
    mapId: 'docServiceMap',
    idProperty: 'id',
    properties: Object.keys(DOC_SERVICE_TO_DB),
  },
  {
    mapId: 'brandMap',
    idProperty: 'id',
    properties: Object.keys(BRAND_TO_DB),
  },
];

module.exports = class StoreDocModel {
  constructor(options) {
    this._db = options.db;
    this.storeDocProductModel = options.storeDocProductModel;
    this.employeeModel = options.employeeModel;
    this.businessSupplierModel = options.businessSupplierModel;
    this.clientModel = options.clientModel;
    this.storeProductModel = options.storeProductModel;
    this.warehousesModel = options.warehousesModel;
    this.wmsModel = options.wmsModel;
    this.externalApiModel = options.externalApiModel;
    this.transactionPrefix = 'DOC';
    this.table = 'store_docs_tbl';
    this.storeDocServiceModel = options.storeDocServiceModel;
    this.orderRequestService = options.orderRequestService;
  }


  async updateAutoPairingDocs(businessId, docNum, sign, managerId, trx) {
    const db = trx ? trx : this._db;
    let insertMinSum, inequality;
    const lastDocId = await db('debts_tbl')
      .select('debt_id_pk as id')
      .orderBy('debt_id_pk', 'desc')
      .limit(1)

    let pairingObjects = await db('debts_tbl')
      .select('debt_id_pk as id')
      .select('debt_doctype as type')
      .select('debt_sign_col as orderSign')
      .select('debt_amount_left as amountLeft')
      .where('debt_related_doc', docNum)
      .where('debt_bsn_id_fk', businessId)
      .where('debt_amount_left', '>', 0)
      .where('debt_sign_col', '!=', sign)
      .where('debt_id_pk', '!=', lastDocId[0].id)

    for(const pair of pairingObjects) {
      let ord = await db('debts_tbl')
      .select('debt_id_pk as id')
      .select('debt_amount_left as ordAmount')
      .where('debt_sign_col', '=', sign)
      .where('debt_bsn_id_fk', businessId)
      .where('debt_id_pk', lastDocId[0].id)
      .first()
      if (pair.amountLeft > ord.ordAmount) {
        inequality = Math.abs(pair.amountLeft - ord.ordAmount);
      }
      
      insertMinSum = Math.min(pair.amountLeft, ord.ordAmount)

      let objAmount = Math.abs((pair.amountLeft  *-1) + ord.ordAmount);

      await db('debts_tbl')
      .update('debt_amount_left', inequality ? 0 : objAmount)
      .where('debt_sign_col', '=', sign)
      .where('debt_bsn_id_fk', businessId)
      .where('debt_id_pk', '=', lastDocId[0].id)

      await db('debts_tbl')
      .update('debt_amount_left', inequality ? inequality : 0)
      .where('debt_sign_col', '!=', sign)
      .where('debt_id_pk', pair.id)
      .where('debt_related_doc', docNum)
      .where('debt_bsn_id_fk', businessId)
      .where('debt_id_pk', '!=', lastDocId[0].id)

      let pairInsert = {
        pair_debt_bsn_id_fk: businessId,
        pair_debit_id: pair.orderSign == '-' ? ord.id : pair.id,
        pair_credit_id: pair.orderSign == '-' ? pair.id : ord.id,
        pair_debt_sum: insertMinSum,
        debts_pairs_rsp_id: managerId ? managerId : null
      }
      await db('debts_pairs_tbl')
        .insert(pairInsert);
    }
  }

  async update(document, filters, trx, scope) {
    const db = trx ? trx : this._db;
    let doneFromNew = null;
    let sign;
    let insertObject;
    let allowedDocTypes = [
      { docType: 'INC'},
      { docType: 'CRT'},
      { docType: 'SRV'},
      { docType: 'OUT'},
      { docType: 'SRT'},
      { docType: 'VRT'},
    ];
    const result = await db.transaction(async trx => {
      await trx.raw('set transaction isolation level read uncommitted;');


      document.docProductsPassed = document.docProducts != null;
      document.docProducts = document.docProductsPassed ? document.docProducts : [];
      let updateResultProducts = null;
      let updateResult = null;
      let newFromDone = null;

      if (document.docProducts) {

        document.docProducts = await this.addMissingProducts(document.businessId, document.docProducts, trx);
        
        if(document.context === 'ORDER'){
          if(document.type === 'INCOME')
            document.docProducts = document.docProducts.map(el => ({...el, getFromAddress: null, addToAddress: null}));

          if(document.type === 'EXPENSE')
            document.docProducts = document.docProducts.map(el => ({...el, getFromAddress: null}));
        }
      }

      // get old document
      const oldDocument = await trx(this.table).where({
        [TO_DB.id]: filters.id,
      });
      
      if (!document.context || !document.documentType || !document.type || !document.status || !document.warehouseId || !document.operationCode) {
        document.context = document.context || _.get(oldDocument, '[0].std_environment');
        document.documentType = document.documentType || _.get(oldDocument, '[0].std_document_type');
        document.type = document.type || _.get(oldDocument, '[0].std_type');
        document.status = document.status || _.get(oldDocument, '[0].std_status');
        document.warehouseId = document.warehouseId || _.get(oldDocument, '[0].std_whs_id_fk'); 
        document.operationCode = document.operationCode || _.get(oldDocument, '[0].std_operation_code'); 
      }
      const options = {
        operation: 'UPDATE',
        oldStatus: _.get(oldDocument, '[0].std_status'),
        newStatus: document.status,
      }

      // check: if correct the data; if available the count of products;
      if (document.status === STATUSES.DONE) {
        const validate = await this.validateCreate(document, trx, options);
        if (validate.error) {
          throw Boom.badRequest(validate.message);
        }
      }   
      
      // throw forbidden if not available to update DONE documents
      if (!(scope.includes(UPDATE_SUCCESS_ORDER) || scope.includes(ADMIN)) &&
          _.get(oldDocument, '[0].std_status') === STATUSES.DONE) {

        throw Boom.forbidden();
      }

      // set transaction id
      if (!document.transactionId)
        document.transactionId = this.transactionPrefix + (await trx.raw(`select nextval('seq_trx') as id;`)).rows[0].id;
      document.oldTransactionId = _.get(oldDocument, '[0].std_transaction_id');

      // find additional info about
      if (document.status === STATUSES.DONE && _.get(oldDocument, '[0].std_status') === STATUSES.NEW) {
        document.recordDatetime = new Date();
        doneFromNew = true;
      } else if (document.status === STATUSES.NEW && _.get(oldDocument, '[0].std_status') === STATUSES.DONE) {
        document.recordDatetime = new Date();
        newFromDone = true;

        const validate = await this.validateUpdateFromDone({ ...document, id: filters.id, doneDatetime: _.get(oldDocument, '[0].std_done_datetime') }, trx);
        if (_.get(validate, 'error')) {
          throw Boom.badRequest(validate.message);
        }

        await this.processUpdateFromDone({ ...document, id: filters.id }, trx)
      }
      // preprocess the document: set operation code; set quantities; set prices; create secondary documents
      const processedDocument = await this.preprocessDocument(document, trx); 

      // send api order and add docIds to the document
      try {
        if (!_.get(oldDocument, '[0].std_external_api_order_status') &&
            processedDocument.createApiOrder && 
            processedDocument.businessId && 
            processedDocument.counterpartBusinessSupplierId && 
            _.get(processedDocument, 'docProducts.length')) {
          await this.createApiOrder(processedDocument, trx);
        }
      } catch(err) {
        console.error('Could not send API order', err);
      }

      const { id, businessId } = filters;
      if(_.get(document, 'insertMode')) {
        const res = await this.get({ id, businessId });
        res.docProducts = [...res.docProducts, ...processedDocument.docProducts];
        processedDocument.sum = res.docProducts.reduce((acc, {stockPrice, quantity}) => acc + (Number(stockPrice) * Number(quantity)), 0)
        processedDocument.sellingSum = res.docProducts.reduce((acc, {sellingPrice, quantity}) => acc + (Number(sellingPrice) * Number(quantity)), 0)
      }

      // convert
      const dbDocument = convert(processedDocument, TO_DB);
      const dbFilters = convert(filters, TO_DB);

      // update the document
      if (Object.keys(dbDocument).length) {
        delete dbFilters.std_mng_id_fk; // why do we need to filter this by manager id?
        updateResult = await trx(this.table)
          .update(dbDocument)
          .where(dbFilters);
      }

      // update the document's products (delete/add)
      if (document.docProductsPassed) {
        if (!_.get(document, 'insertMode')) {
          await this.storeDocProductModel.delete({
            docId: filters.id,
          }, trx);
        }

        updateResultProducts = await this.storeDocProductModel
          .add(filters.id, processedDocument, { 
            doneFromNew,
            newFromDone,
            apiSent: _.get(oldDocument, '[0].std_external_api_order_status') !== 'SENT' && document.externalApiOrderStatus === 'SENT',
            trx 
          });
      } 
      
      if(updateResult && (_.get(processedDocument, 'operationCode') == 'INC' || _.get(processedDocument, 'operationCode') == 'COM' && _.get(document, 'isAddToOrder')) ) {
        await this.addProductIntoOrderFromStoreDoc({document: processedDocument, trx, credentials: filters.credentials});
      }

      const result = await this.get({ id, businessId });
      const { type, status, counterpartBusinessSupplierId, counterpartClientId, businessSupplierRequisiteId, 
        clientRequisiteId, operationCode, documentNumber, doneDatetime, remainSum, sellingSumTax, managerId, businessRequisiteId } = result;
      let correctDocType = allowedDocTypes.find(el => el.docType === operationCode ? true : false)
      
      if((document.status !== _.get(oldDocument, '[0].std_status')) && correctDocType) {

        if(document.status === 'NEW' && (operationCode === 'OUT' || operationCode === 'SRT' || operationCode === 'VRT')) {
          sign = '-';
        }else if (document.status === 'DONE' && (operationCode === 'OUT' || operationCode === 'SRT' || operationCode === 'VRT')) {
          sign = '+';
        }
        if(document.status === 'DONE' && (operationCode !== 'OUT' && operationCode !== 'SRT' && operationCode !== 'VRT')) {
          sign = '-';
        }else if (document.status === 'NEW' && (operationCode !== 'OUT' && operationCode !== 'SRT' && operationCode !== 'VRT')) {
          sign = '+';
        }
        let respiteDays;
        if(counterpartClientId) {
          respiteDays = await trx('clients_tbl')
          .select('cln_payment_respite as days')
          .where('cln_id_pk', counterpartClientId)
          .first()
        }
        if(counterpartBusinessSupplierId) {
          respiteDays = trx('business_suppliers_tbl')
          .select('bsp_payment_respite as days')
          .where('bsp_id_pk', counterpartBusinessSupplierId)
          .first()
        }
        let storeDocSum = Math.round((sellingSumTax + Number.EPSILON) * 100) / 100;

        insertObject = {
          debt_bsn_id_fk: businessId,
          debt_doctype: operationCode,
          debt_doc_num: documentNumber,
          debt_cor_type: counterpartClientId ? 'client' : 'supplier',
          debt_cor_id: counterpartClientId ? counterpartClientId : counterpartBusinessSupplierId,
          debt_rqt_cor_id: clientRequisiteId ? clientRequisiteId : businessSupplierRequisiteId,
          debt_rqt_cor_bsn_id: businessRequisiteId || null,
          debt_sign_col: sign,
          debt_sum_col: storeDocSum,
          debt_amount_left: storeDocSum,
          debt_std_id: id,
          debt_payment_date_col: document.payUntilDatetime ? document.payUntilDatetime 
          : moment().add(Number(respiteDays.days), 'day').toISOString(),
          debt_related_doc: documentNumber,
          debt_done_datetime: doneDatetime
        }
        await trx('debts_tbl')
        .insert(insertObject)

        await this.updateAutoPairingDocs(businessId, documentNumber, sign, managerId, trx);
      }
      return updateResult || updateResultProducts;
    });

    return result;
  }

  async addProductIntoOrderFromStoreDoc(options) {
    const {document, trx, credentials} = options;
    if(_.get(document, 'operationCode') == 'INC' || _.get(document, 'operationCode') == 'COM') {
      const docProducts = _.get(document, 'docProducts');

      const arrayOfProductIds = [];
      docProducts.filter(({productId}) => arrayOfProductIds.push(productId))

      const queryProducts = await trx('store_doc_products_tbl')
        .select({
          id: 'sdp_id_pk',
          productId: 'sdp_stp_id_fk', 
          storeGroupId: 'stp_stg_id_fk',
          name: 'stp_name',
          productCode: 'stp_code',
          partUnitId: 'sdp_mu_id_fk', 
          supplierBrandId: 'stp_brt_id_fk',
          addToAddress: 'sdp_add_address_ref',
          quantity: 'sdp_quantity',
          sellingPrice: 'sdp_selling_price',
          stockPrice: 'sdp_stock_price',
          orderId: 'sdp_ord_id_fk',
          comment: 'sdp_comment',
          warehouseId: 'std_whs_id_fk',
        })
        .leftJoin('store_products_tbl', 'stp_id_pk', 'sdp_stp_id_fk')
        .leftJoin('store_docs_tbl', 'std_id_pk', 'sdp_std_id_fk')
        .whereIn('sdp_stp_id_fk', arrayOfProductIds)

      const detailsOfOrder = [];

      for(let product of docProducts) {
        const dataOfProduct = queryProducts.find(({productId}) => product.productId == productId);

        _.merge(product, dataOfProduct);

        if(_.get(product, 'orderId')) {
          const findProductOrder = await trx('orders_simple_appurtenancies_tbl')
            .select({
              orderProductId: 'oap_id_pk'
            })
            .where({
              oap_ord_id_fk: product.orderId,
              oap_code: product.productCode,
              oap_brt_id_fk: product.supplierBrandId,
            })
            .whereNot({oap_status: 'READY'})
            .first();

          if(_.get(findProductOrder, 'orderProductId')) {
            await this.reserveAllPossible({
              ordersAppurtenanciesIds: [findProductOrder.orderProductId],
              businessId: document.businessId,
              managerId: document.managerId,
            }, trx);
          } else {
              detailsOfOrder.push({
                  oap_comment: {positions: [], comment: product.comment},
                  oap_count: product.quantity,
                  oap_name: product.name,
                  oap_mu_id_fk: product.partUnitId,
                  oap_price: product.sellingPrice,
                  oap_code_original: product.productCode,
                  oap_stp_id_fk: product.productId,
                  oap_purchase_price: product.stockPrice,
                  oap_stg_id_fk: product.storeGroupId,
                  oap_brt_id_fk: product.supplierBrandId,
                  oap_cell_address: product.addToAddress,
                  oap_bsp_id_fk: 0,
                  oap_ord_id_fk: product.orderId,
                })
          }
        }
      }

      const insertedIds = await trx('orders_simple_appurtenancies_tbl').insert(detailsOfOrder).returning('oap_id_pk');

      await this.reserveAllPossible({
        ordersAppurtenanciesIds: insertedIds,
        businessId: document.businessId,
        managerId: document.managerId,
      }, trx);
    }
  }

  async addProductsIntoOrder(options) {
      const {productIds, businessId, addAvailable} = options;
      const arrayOfAvailable = [], arrayOfNotAvailable = [];

      const queryProducts = await this._db('store_doc_products_tbl')
        .select({
          id: 'sdp_id_pk',
          productId: 'sdp_stp_id_fk', 
          storeGroupId: 'stp_stg_id_fk',
          name: 'stp_name',
          productCode: 'stp_code',
          partUnitId: 'sdp_mu_id_fk', 
          supplierBrandId: 'stp_brt_id_fk',
          addToAddress: 'sdp_add_address_ref',
          quantity: 'sdp_quantity',
          sellingPrice: 'sdp_selling_price',
          stockPrice: 'sdp_stock_price',
          orderId: 'sdp_ord_id_fk',
          comment: 'sdp_comment',
          warehouseId: 'std_whs_id_fk',
        })
        .leftJoin('store_products_tbl', 'stp_id_pk', 'sdp_stp_id_fk')
        .leftJoin('store_docs_tbl', 'std_id_pk', 'sdp_std_id_fk')
        .whereIn('sdp_id_pk', productIds)
      
      for(let product of queryProducts) {
        if(_.get(product, 'orderId')) {
          const findProductOrder = await this._db('orders_simple_appurtenancies_tbl')
            .select({
              orderProductId: 'oap_id_pk'
            })
            .where({
              oap_ord_id_fk: product.orderId,
              oap_code: product.productCode,
              oap_brt_id_fk: product.supplierBrandId,
            })
            .first();

          if(_.get(findProductOrder, 'orderProductId')) {
            if(addAvailable) {
              arrayOfNotAvailable.push({
                  oap_comment: {positions: [], comment: product.comment},
                  oap_count: product.quantity,
                  oap_name: product.name,
                  oap_mu_id_fk: product.partUnitId,
                  oap_price: product.sellingPrice,
                  oap_code_original: product.productCode,
                  oap_stp_id_fk: product.productId,
                  oap_purchase_price: product.stockPrice,
                  oap_stg_id_fk: product.storeGroupId,
                  oap_brt_id_fk: product.supplierBrandId,
                  oap_cell_address: product.addToAddress,
                  oap_whs_id_fk: product.warehouseId,
                  oap_ord_id_fk: product.orderId,
                  oap_bsp_id_fk: 0,
              })
            }
            if(!addAvailable) {
              arrayOfAvailable.push(product.id);
            }
          } else {
            arrayOfNotAvailable.push({
                oap_comment: {positions: [], comment: product.comment},
                oap_count: product.quantity,
                oap_name: product.name,
                oap_mu_id_fk: product.partUnitId,
                oap_price: product.sellingPrice,
                oap_code_original: product.productCode,
                oap_stp_id_fk: product.productId,
                oap_purchase_price: product.stockPrice,
                oap_stg_id_fk: product.storeGroupId,
                oap_brt_id_fk: product.supplierBrandId,
                oap_cell_address: product.addToAddress,
                oap_whs_id_fk: product.warehouseId,
                oap_ord_id_fk: product.orderId,
                oap_bsp_id_fk: 0,
            })
          }
        }
      }

      const insertedIds = await this._db('orders_simple_appurtenancies_tbl').insert(arrayOfNotAvailable).returning('oap_id_pk');

      return {added: _.get(insertedIds, 'length') ? insertedIds : false, available: arrayOfAvailable}
   }

  async get(filters, trx) {
    const dbFilters = convert(filters, TO_DB);
    const managerFields = MANAGER_TO_DB_WITH_PREFIX;
    delete managerFields.manager_password;
    delete managerFields.manager_cashierApiToken;

    const db = trx ? trx : this._db;

    const query = db(this.table)
      .select(
        this._db.raw(`warehouse.whs_name as store_docwarehouseName`),
        'warehouse.whs_attribute as store_docwrhAttribute',
        'bsp_name as store_doccounterpartBusinessSupplierName',
        'counterpart_whs.whs_name as store_doccounterpartWarehouseName',
        'counterpart_whs.whs_attribute as store_doccounterpartWhsAttribute',
        this._db.raw(`TRIM(CONCAT(cln_name, ' ', cln_surname))  as "store_doccounterpartClientName"`),
        'cln_phones as store_doccounterpartClientPhones',
        this._db.raw(`TRIM(CONCAT(eml_name, ' ', eml_surname)) as "store_doccounterpartEmployeeName"`),
        this._db.raw(`std_operation_code ||'-'|| std_bsn_id_fk ||'-'|| std_id_pk as "store_docdocumentNumber"`),
        'bct_barcode as store_docbarcode',
        this._db.raw(`
          coalesce((
            select oap_ord_id_fk from orders_simple_appurtenancies_tbl where oap_id_pk = (sdp_oap_ids_fk)[1] limit 1
          ), ord_id_pk, null) as "store_doc_productorderId"
        `),
        this._db.raw(`
        coalesce((
          select ord_num 
          from orders_simple_appurtenancies_tbl 
          left join orders_tbl on ord_id_pk = oap_ord_id_fk
          where oap_id_pk = (sdp_oap_ids_fk)[1] limit 1
        ), ord_num, null) as "store_doc_productorderNum"
      `)
      )
      .select(this._db.raw(`
              round(coalesce((
                case 
                  when std_type = 'EXPENSE' AND std_document_type = 'CLIENT' AND std_status = 'NEW' AND std_operation_code = 'OUT' then
                    abs(std_selling_sum) 
                    * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
                    - coalesce((${docPaidSumPositive()} - ${docPaidSumNegative()}), 0)

                  when std_type = 'EXPENSE' AND std_document_type = 'CLIENT' AND std_status = 'DONE' AND std_operation_code = 'OUT' then
                    coalesce(${docPaidSumDone()}, 0)

                  when std_type = 'INCOME' AND std_document_type = 'SUPPLIER' AND std_status = 'DONE' AND std_operation_code in('INC', 'SRV') then
                    coalesce(${docPaidSumDone()}, 0)
                  
                  when std_type = 'INCOME' AND std_document_type = 'SUPPLIER' AND std_status = 'NEW' AND std_operation_code in('INC', 'SRV') then
                    (case when (std_operation_code = 'SRV') then 
                      abs(std_sum)
                      * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
                      - coalesce((${docPaidSumPositive()} - ${docPaidSumNegative()}), 0)
                      else
                      abs(std_selling_sum) 
                      * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
                      - coalesce((${docPaidSumPositive()} - ${docPaidSumNegative()}), 0)
                      end)

                  when std_type = 'EXPENSE' AND std_document_type = 'SUPPLIER' AND std_status = 'NEW' AND std_operation_code = 'SRT' then
                        abs(std_selling_sum) 
                        * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
                        - coalesce((${docPaidSumPositive()} - ${docPaidSumNegative()}), 0)

                  when std_type = 'EXPENSE' AND std_document_type = 'SUPPLIER' AND std_status = 'DONE' AND std_operation_code = 'SRT' then
                    coalesce(${docPaidSumDone()},0)

                  when std_type = 'INCOME' AND std_document_type = 'CLIENT' AND std_status = 'NEW' AND std_operation_code = 'CRT'  then
                    abs(std_selling_sum) 
                    * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
                    - coalesce((${docPaidSumPositive()} - ${docPaidSumNegative()}), 0)

                  when std_type = 'INCOME' AND std_document_type = 'CLIENT' AND std_status = 'DONE' AND std_operation_code = 'CRT'  then
                    coalesce(${docPaidSumDone()},0)

                  when std_type = 'INCOME' AND std_document_type = 'CLIENT' AND std_operation_code = 'CRA' then
                    abs(std_selling_sum) 
                    * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
                    + ${paidSum('std_id_pk', 'std_document_type')}

                  when std_type = 'INCOME' AND std_document_type = 'CLIENT'  then
                    abs(std_selling_sum) 
                    * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
                    + ${paidSum('std_id_pk', 'std_document_type')}
          
                  when std_type = 'EXPENSE' AND std_document_type = 'CLIENT' then
                  (case when ( std_operation_code = 'AUT') then 
                    abs(std_selling_sum) 
                    * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
                    - ${paidSum('std_id_pk', 'std_document_type')}
                  else
                    abs(std_selling_sum) 
                    * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
                    - ${paidSum('std_id_pk', 'std_document_type')}
                  end)

                  when std_type = 'EXPENSE' AND std_document_type = 'CLIENT' then
                    abs(std_selling_sum) 
                    * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
                    - ${paidSum('std_id_pk', 'std_document_type')}

                  when std_type = 'EXPENSE' AND std_document_type = 'OWN_CONSUMPTION' then
                    (case when (std_operation_code = 'CST') then 
                      abs(std_selling_sum) 
                      + ${paidSum('std_id_pk', 'std_document_type')}
                    else
                      abs(std_selling_sum) 
                      * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
                      + ${paidSum('std_id_pk', 'std_document_type')}
                    end)
                    
                  
                  when std_type = 'EXPENSE' AND std_document_type = 'SUPPLIER' then
                    (case when ( std_operation_code = 'SRT') then 
                      abs(std_selling_sum) 
                      * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
                      - ${paidSum('std_id_pk', 'std_document_type')}
                    else 
                      abs(std_selling_sum) 
                      * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
                      - ${paidSum('std_id_pk', 'std_document_type')}
                    end)

          
                  when std_type = 'INCOME' AND std_document_type = 'SUPPLIER' then
                      abs(std_selling_sum) 
                      * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
                      + ${paidSum('std_id_pk', 'std_document_type')}

                  when std_type = 'INCOME' AND std_document_type = 'INVENTORY' then
                      abs(std_selling_sum) 
                      * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
                      + ${paidSum('std_id_pk', 'std_document_type')}

                  when std_type = 'INCOME' AND std_document_type = 'SERVICE' then
                      (case when (std_operation_code = 'SRV') then 
                        abs(std_sum)
                        * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
                        + ${paidSum('std_id_pk', 'std_document_type')}
                      else
                        abs(std_selling_sum) 
                        * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
                        + ${paidSum('std_id_pk', 'std_document_type')}
                      end)

                    when std_type = 'EXPENSE' AND std_document_type = 'SERVICE' AND std_status = 'DONE' AND std_operation_code = 'VRT' then
                      coalesce(${docPaidSumDone()},0)

                    when std_type = 'EXPENSE' AND std_document_type = 'SERVICE' then
                      (case when (std_operation_code = 'VRT') then 
                        abs(std_sum)
                        * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
                        - ${paidSum('std_id_pk', 'std_document_type')}
                      else
                        abs(std_selling_sum) 
                        * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
                        - ${paidSum('std_id_pk', 'std_document_type')}
                      end)

                  when std_type = 'INCOME' then
                      abs(std_selling_sum) 
                      * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
                      + ${paidSum('std_id_pk', 'std_document_type')}

                  when std_type = 'EXPENSE' and std_document_type = 'ADJUSTMENT' then
                      abs(std_selling_sum) 
                      * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
                      + ${paidSum('std_id_pk', 'std_document_type')}

                  when std_type = 'EXPENSE' AND std_document_type = 'INVENTORY' then
                  (case when (std_operation_code = 'STM') then 
                    abs(std_selling_sum)
                  else
                    abs(std_selling_sum) 
                    * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
                    + ${paidSum('std_id_pk', 'std_document_type')}
                  end)

                  when std_type = 'EXPENSE' AND std_document_type = 'TRANSFER' then
                      abs(std_selling_sum)
                      + ${paidSum('std_id_pk', 'std_document_type')}
                  
                  when std_type = 'EXPENSE' then
                      abs(std_selling_sum) 
                      * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
                      + ${paidSum('std_id_pk', 'std_document_type')}
          
                  else 0
                end
              ), 0)::numeric, 2)::float as "store_docremainSum"
      `))

      //.select(this._db.raw(`${remainingSumQuery()} as "store_docremainSum"`))
      .select(this._db.raw(`${sumWithTaxQuery()} as "store_docsumTax"`))
      .select(this._db.raw(` ${showTaxQuery()} as "store_docshowTax"`))
      .select({
        ...TO_DB_WITH_PREFIX,
        ...DOC_PRODUCT_TO_DB_WITH_PREFIX,
        ...PRODUCT_TO_DB_WITH_PREFIX,
        ...BUSINESS_SUPPLIER_TO_DB_WITH_PREFIX,
        ...MANAGER_TO_DB_WITH_PREFIX,
        ...BRAND_TO_DB_WITH_PREFIX,
        ...DOC_SERVICE_TO_DB_WITH_PREFIX,
      })
      .select(this._db.raw(`
          round(coalesce((
          case 
          when std_type = 'INCOME' AND std_document_type = 'CLIENT' AND std_operation_code = 'CRT' then
              abs(std_selling_sum) 
              * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)

          when std_type = 'INCOME' AND std_document_type = 'CLIENT' AND std_operation_code = 'CRA' then
              abs(std_selling_sum) 
              * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)

          when std_type = 'INCOME' AND std_document_type = 'CLIENT' then
            abs(std_selling_sum) 
            * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)

          when std_type = 'EXPENSE' AND std_document_type = 'CLIENT' then
            (case when ( std_operation_code = 'AUT') then 
              abs(std_selling_sum) 
              * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
            else 
              abs(std_selling_sum) 
              * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
            end)
          
          when std_type = 'EXPENSE' AND std_document_type = 'SUPPLIER' then
              abs(std_selling_sum) 
              * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end) 
          
          when std_type = 'INCOME' AND std_document_type = 'SUPPLIER' then
              abs(std_selling_sum) 
              * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)

          when std_type = 'INCOME' AND std_document_type = 'SERVICE' then
            (case when (std_operation_code = 'SRV') then 
              abs(std_sum)
              * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
            else
              abs(std_selling_sum) 
              * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
            end)

          when std_type = 'EXPENSE' AND std_document_type = 'SERVICE' then
            (case when (std_operation_code = 'VRT') then 
              abs(std_sum)
              * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
            else
              abs(std_selling_sum) 
              * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
            end)  

          when std_type = 'INCOME' then
              abs(std_selling_sum) 
              * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)

          when std_type = 'EXPENSE' and std_document_type = 'ADJUSTMENT' then
              abs(std_selling_sum) 
              * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)

          when std_type = 'EXPENSE' AND std_document_type = 'OWN_CONSUMPTION' then
              (case when (std_operation_code = 'CST') then 
                abs(std_selling_sum)
              else
                abs(std_selling_sum) 
                * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
              end) 

          when std_type = 'EXPENSE' AND std_document_type = 'TRANSFER' then
                abs(std_selling_sum)
              


          when std_type = 'EXPENSE' then
            (case when (std_operation_code = 'STM') then 
              abs(std_selling_sum)
            else
            abs(std_selling_sum) 
            * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
            end)

          else 0
        end
      ), 0)::numeric, 2)::float as "store_docsellingSumTax"
      `))

      .select(this._db.raw(`
          round(coalesce((
          case 
          when std_type = 'INCOME' AND std_document_type = 'CLIENT' then
            abs(std_selling_sum +  0) 
          
          when std_type = 'INCOME' AND std_document_type = 'CLIENT'  then
            abs(std_selling_sum) 

          when std_type = 'EXPENSE' AND std_document_type = 'CLIENT' then
            abs(std_selling_sum) 

          when std_type = 'EXPENSE' AND std_document_type = 'SUPPLIER' then
            abs(std_selling_sum)

          when std_type = 'INCOME' AND std_document_type = 'SERVICE' then  
            (case when (std_operation_code = 'SRV') then 
              abs(std_sum)
            else
              abs(std_selling_sum) 
            end)

          when std_type = 'EXPENSE' AND std_document_type = 'SERVICE' then  
            (case when (std_operation_code = 'VRT') then 
              abs(std_sum)
            else
              abs(std_selling_sum) 
            end)

          when std_type = 'INCOME' AND std_document_type = 'SUPPLIER' then
            abs(std_selling_sum) 

          when std_type = 'INCOME' AND std_document_type = 'INVENTORY' then
            abs(std_selling_sum)

            when std_type = 'INCOME' then
            abs(std_selling_sum)
          
          when std_type = 'EXPENSE' AND std_document_type = 'INVENTORY' then
            abs(std_selling_sum) 

          when std_type = 'EXPENSE' then
            abs(std_selling_sum) 

          else 0
        end
      ), 0)::numeric, 2)::float as "store_docsellingSum"
      `))
      .select('bsn_income_only_with_cell as store_docincomeOnlyWithCell')
      .select(this._db.raw('std_sum + 0 as store_docsum'))
      .select('ord_num as store_docordNum')
      .leftJoin('store_doc_products_tbl', 'sdp_std_id_fk', 'std_id_pk')
      .leftJoin('store_products_tbl', 'stp_id_pk', 'sdp_stp_id_fk')
      .leftJoin('store_doc_services_tbl', 'sds_std_id_fk','std_id_pk')
      .leftJoin('analytics_tbl', 'sds_ans_unique_id_fk', 'ans_id_pk')
      .leftJoin('orders_tbl', 'ord_id_pk', 'std_ord_id_fk')
      .leftJoin('managers_tbl', 'mng_id_pk', 'std_mng_id_fk')
      .leftJoin('brands_tbl', 'brt_id_pk', 'stp_brt_id_fk')
      .leftJoin('businesses_tbl', 'bsn_id_pk', 'std_bsn_id_fk')
      .leftJoin(this._db.raw('warehouses_tbl as warehouse on std_whs_id_fk = warehouse.whs_id_pk'))
      .leftJoin('business_suppliers_tbl', 'std_counterpart_bsp_id_fk', 'bsp_id_pk')
      .leftJoin('clients_tbl', 'std_counterpart_cln_id_fk', 'cln_id_pk')
      .leftJoin(this._db.raw('warehouses_tbl as counterpart_whs on std_counterpart_whs_id_fk = counterpart_whs.whs_id_pk'))
      .leftJoin('employees_tbl', 'std_counterpart_eml_id_fk', 'eml_id_pk')
      .leftJoin(this._db.raw(`barcodes_tbl on bct_ref_id::int = std_id_pk and bct_table = 'STORE_DOCS'`))
      .leftJoin('requisites_tbl', 'std_rqt_id_fk', 'rqt_id_pk')
      .leftJoin('business_suppliers_requisites_tbl', 'std_bsr_id_fk', 'bsr_id_pk')
      .leftJoin('clients_requisites_tbl', 'std_crq_id_fk', 'crq_id_pk')
      .leftJoin('measurement_units_tbl', 'sdp_mu_id_fk', 'mu_id_pk')
      .where(dbFilters);

    if(filters.map) {
      query.whereNot({std_operation_code: 'RES'})
      if(filters.orderId && filters.businessId) {
        query.orWhere({
          std_bsn_id_fk: filters.businessId,
          sds_ord_id_fk: filters.orderId,
        })
        .orWhere({
          std_bsn_id_fk: filters.businessId,
          sdp_ord_id_fk: filters.orderId
        })
        .whereNot({std_operation_code: 'RES'})
      }

      if(filters.storeDocIds) {
        query.whereIn('std_id_pk', filters.storeDocIds)
      }
      
      const resultSet = await query;

      const result = joinjs.map(
        resultSet,
        MAPS,
        'storeDocMap',
        JOIN_PREFIX,
        false
      );

      return result;
    } else {
      const resultSet = await query;

      let result = joinjs.mapOne(
        resultSet,
        MAPS,
        'storeDocMap',
        JOIN_PREFIX,
        false
      );
  
      if (result && result.docProducts) {
        result.docProducts = _.sortBy(result.docProducts, ['order']);
        result.docProducts.forEach(el => el.measureUnit = typeof el.measureUnit == 'object' && el.measureUnit ? el.measureUnit[filters.language] : el.measureUnit)
      }
      try {
        result = await this.decorateWithProductStatus(result);
      } catch (err) {
        throw Boom.badRequest(err);
      }

      return result;
    }

  }

  async delete(filters) {
    const oldStoreDoc = await this.get(filters);
    if (oldStoreDoc.status === STATUSES.DONE) {
      const currentDateString = moment().format('YYYY-MM-DD');
      for (const docProduct of oldStoreDoc.docProducts) {
        const balance = await this.storeDocProductModel.getBalance({
          businessId: filters.businessId,
          productId: docProduct.productId,
          date: currentDateString,
        });

        const productBalance = balance.list[0];

        if (
          productBalance.remaining -
            productBalance.reserved -
            docProduct.quantity <
          0
        ) {
          throw new ApplicationError(STORE_DOC_PRODUCTS_ARE_USED, true, {});
        }
      }
    }

    const dbFilters = convert(filters, TO_DB);

    return await this._db(this.table)
      .where(dbFilters)
      .delete();
  }

  async create(document, _trx) {
    const db = _trx ? _trx : this._db;

    const result = await db.transaction(async trx => {
      document.docProductsPassed = document.docProducts != null;
 
      if (document.docProducts)
        document.docProducts = await this.addMissingProducts(document.businessId, document.docProducts, trx);
      // check: if correct the data; if available the count of products;
      if (document.status === STATUSES.DONE) {
        const validate = await this.validateCreate(document, trx);
        
        if (validate.error) {
          throw Boom.badRequest(validate.message);
        }
      }

      // set transaction id
      if (!document.transactionId)
        document.transactionId = this.transactionPrefix + (await trx.raw(`select nextval('seq_trx') as id;`)).rows[0].id;

      // preprocess the document: set operation code; set quantities; set prices; create secondary documents
      const processedDocument = await this.preprocessDocument(document, trx);
      // set created datetime
      processedDocument.createdDatetime = new Date();

      if (processedDocument.dontCreateIfEmpty && !processedDocument.docProducts.length) {
        return {
          id: null,
          docProducts: [],
        }
      }

      // send api order and add docIds to the document
      try {
        if (processedDocument.createApiOrder && 
            processedDocument.businessId && 
            processedDocument.counterpartBusinessSupplierId && 
            _.get(processedDocument, 'docProducts.length')) {
          await this.createApiOrder(processedDocument, trx);
        }
      } catch(err) {
        console.error('Could not send API order', err);
      }

      // convert to db object
      const dbStoreDoc = convert(processedDocument, TO_DB);
      // insert the document
      const [id] = await trx(this.table)
        .insert(dbStoreDoc)
        .returning(TO_DB.id);

      // insert the products of the document
      await this.storeDocProductModel.add(id, processedDocument, {
        doneFromNew: processedDocument.status === STATUSES.DONE,
        apiSent: document.externalApiOrderStatus === 'SENT',
        trx 
      });

      if(_.get(document, 'docServices')) 
        await this.storeDocServiceModel.add(id, _.get(document, 'docServices'),trx)

      return { ...processedDocument, id, docProducts: document.docProducts };
    });

    // result - the id of the document that created or an error object
    return result;
  }

  async validateCreate(document, trx, options={}) {
    const { type } = document;
    
    const dataErrors = await this.validateData(document, trx, options);
    const countErrors = type === TYPES.EXPENSE ? 
      await this.validateAvailability(document, trx) : [];

    let errorMessage = '';
    for (let error of dataErrors) {
      errorMessage += error.message + ' ';
    }
    for (let error of countErrors) {
      errorMessage += error.message + ' ';
    }

    return { 
      error: !!(dataErrors.length + countErrors.length), 
      message: errorMessage
    };
  }

  async validateData(document, trx, options) {
    const errors = [];
    const {
      counterpartBusinessSupplierId,
      counterpartWarehouseId,
      counterpartEmployeeId,
      counterpartClientId,
      warehouseId,
      businessId,
      documentType,
      context,
      status,
      type,
      doneDatetime,
    } = document;
    
    const {
      operation,
      oldStatus,
      newStatus,
    } = options;
    /**
     * SERVICE
     * Service does not have a reference to warehouses
     */
    if (context === CONTEXTS.STOCK && documentType === DOCUMENT_TYPES.SERVICE) {
      if (counterpartBusinessSupplierId === null || counterpartBusinessSupplierId === undefined) {
        errors.push({ code: 'NOT_FOUND_BUSINESS_SUPPLIER', message: `Ід постачальника обов'язкове.` });
      }

      return errors;
    }

    // validate doneDatetime
    if (doneDatetime && operation === OPERATIONS.UPDATE && oldStatus === STATUSES.DONE && newStatus === STATUSES.DONE) {
      const { datetime: minDatetime } = await this.getAvailableMinDatetime(document);
      const givenDatetime = moment(document.doneDatetime);

      if (!givenDatetime.isSameOrAfter(minDatetime)) {
        errors.push({ code: 'INVALID_DONE_DATETIME', message: `Неправильна дата. Мінімальна дата: ${minDatetime}` });
      }
    }

    if (context === CONTEXTS.STOCK) {
      /* check if the user gave valid warehouseIds */
      const warehouse = _.get(await this.warehousesModel.getWarehouses({businessId, id:warehouseId}, trx), '[0]');
      if (!warehouse) {
        errors.push({ code: 'NOT_FOUND_WAREHOUSE', message: `Склад не знайдений: ${warehouseId}.` });
      }
      let counterpartWarehouse = null;
      if(counterpartWarehouseId) {
        counterpartWarehouse = _.get(await this.warehousesModel.getWarehouses({businessId, id:counterpartWarehouseId}), '[0]');
        if (!counterpartWarehouse) {
          errors.push({ code: 'NOT_FOUND_WAREHOUSE', message: `Склад не знайдений: ${counterpartWarehouseId}.` });
        }
      }


      /* SUPPLIER */
      if (documentType === DOCUMENT_TYPES.SUPPLIER) {
        if (counterpartBusinessSupplierId === null || counterpartBusinessSupplierId === undefined) {
          errors.push({ code: 'NOT_FOUND_BUSINESS_SUPPLIER', message: `Ід постачальника обов'язкове.` });
        }
      }
      /* CLIENT */
      else if (documentType === DOCUMENT_TYPES.CLIENT) {
        if (!counterpartClientId) {
          errors.push({ code: 'NOT_FOUND_CLIENT', message: `Ід клієнта обов'язкове.` });
        }
      }
      /* INVENTORY */
      else if (documentType === DOCUMENT_TYPES.INVENTORY) {
        /*//TODO think about why we need here counterpart warehouse id...
        if (!counterpartWarehouseId) {
          errors.push({ code: 'NOT_FOUND_WAREHOUSE', message: `Ід складу обов'язкове.` });
        }
        */
      }
      /* OWN_CONSUMPTION */
      else if (documentType === DOCUMENT_TYPES.OWN_CONSUMPTION) {
        if (type === TYPES.INCOME) {
          errors.push({ code: 'INVALID_TYPE', message: `Тип має бути прихідним.` });
        } else {
          if (status === STATUSES.DONE) {
            if (!counterpartEmployeeId) {
              errors.push({ code: 'NOT_FOUND_EMPLOYEE', message: `Ід співробітника обов'язкове.` });
            }
          }
        }
      } 
      /* TRANSFER */
      else if (documentType === DOCUMENT_TYPES.TRANSFER) {
        if (type === TYPES.INCOME) {
          if (!document.ignoreTypeValidation) {
            errors.push({ code: 'INVALID_TYPE', message: `Тип має бути розхідним.` });
          }
        } else {
          if (status === STATUSES.DONE) {
            if (!counterpartWarehouseId) {
              errors.push({ code: 'NOT_FOUND_WAREHOUSE', message: `Ід складу обов'язкове.` });
            }
          }
        }
      }
    } else if (context === CONTEXTS.ORDER) {
      /* ADJUSTMENT */
      if (documentType === ORDER_DOCUMENT_TYPES.ADJUSTMENT) {
        if (type === TYPES.INCOME) { // order adjustment
          errors.push({ code: 'INVALID_TYPE', message: `Тип має бути розхідним.` });
        }

      /* SUPPLIER */
      } else if (documentType === ORDER_DOCUMENT_TYPES.SUPPLIER) {
        if (!counterpartBusinessSupplierId) {
          errors.push({ code: 'NOT_FOUND_BUSINESS_SUPPLIER', message: `Ід постачальника обов'язкове.` });
        }
      }
    }

    return errors;
  }

  async validateAvailability(document, trx) {
    const errors = [];
    const {
      docProducts,
      warehouseId,
      context
    } = document

    const grouppedProducts = [];
    document.docProducts.reduce(function(res, value) {
      if (!_.get(res, `[${value.productId}][${value.getFromAddress}]`)) {
        res[value.productId] = {};
        res[value.productId][value.getFromAddress] = { ...value, quantity: 0 };
        grouppedProducts.push(res[value.productId][value.getFromAddress])
      }
      res[value.productId][value.getFromAddress].quantity += value.quantity;
      return res;
    }, {});

    for (let product of grouppedProducts) {
      const { 
        skipIfUnavailable,
        getFromAddress,
        takeAvailable,
        productId, 
        quantity,
      } = product;

      const availableCount = await this.storeDocProductModel.countAvailable({ 
        cell: getFromAddress,
        context,
        warehouseId,
        productId,
        keeping: true,
      }, trx);

      if (quantity > availableCount && !takeAvailable && !skipIfUnavailable && context !== 'ORDER' || !skipIfUnavailable && availableCount === 0) {
        errors.push({ code: 'NOT_ENOUGH_PRODUCTS', message: `Недостатньо товару ${productId}. В наявності: ${availableCount}. Потрібно: ${quantity}.` });
      }
      
      document.docProducts = document.docProducts.filter(x => {
        if (x.productId === productId) {
          if (context === 'ORDER' && availableCount < quantity) { // RECEIVE more than ordered
            x.quantity = quantity;    
            return true
          };
          if (quantity <= availableCount) return true;
          if (quantity > availableCount && takeAvailable) return true;
          if (quantity > availableCount && skipIfUnavailable) return false;

          return true;
        }
        
        return true;
      })
    }

    return errors;
  }


  async insertPreprocessDocuments(obj) {
    const db = this._db;
    let respiteDays;
    const { businessId, sellingSum, operationCode, createdDatetime, id, counterpartBusinessSupplierId } = obj;
    let businessSupplierRequisiteId = await db('business_suppliers_requisites_tbl')
      .select('bsr_id_pk as id')
      .where('bsr_bsp_id_fk', counterpartBusinessSupplierId)
      .first()
    if(counterpartBusinessSupplierId) {
        respiteDays = db('business_suppliers_tbl')
        .select('bsp_payment_respite as days')
        .where('bsp_id_pk', counterpartBusinessSupplierId)
        .first()
    }
    const fields = [
      "debt_bsn_id_fk",
      "debt_doctype",
      "debt_doc_num",
      "debt_cor_type",
      "debt_cor_id",
      "debt_rqt_cor_id",
      "debt_rqt_cor_bsn_id",
      "debt_sign_col",
      "debt_sum_col",
      "debt_amount_left",
      "debt_std_id",
      "debt_payment_date_col",
      "debt_related_doc",
      "debt_done_datetime"
    ] 
    let num = operationCode;
    let documentNumber = num.concat('-', businessId, '-', id);
    setTimeout(async () => {
      await db.raw(`
        INSERT INTO debts_tbl (${[fields]}) 
          SELECT 
          ${businessId}, 
          '${operationCode}', 
          '${documentNumber}', 
          'supplier',
          ${counterpartBusinessSupplierId || null},
          null,
          ${businessSupplierRequisiteId == undefined ? null 
          : businessSupplierRequisiteId.id},
          '-',
          ${sellingSum},
          ${sellingSum},
          ${id},
          '${respiteDays == undefined ? createdDatetime 
            : moment().add(Number(respiteDays.days), 'day').toISOString()}',
          '${documentNumber}',
          '${createdDatetime.toISOString()}'
          WHERE 
           EXISTS (SELECT std_id_pk FROM store_docs_tbl WHERE std_id_pk = ${id} AND std_operation_code = 'INC')
    `)
    }, 3500)
  }

  async preprocessDocument(document, trx) {
    const {
      counterpartWarehouseId,
      documentType,
      warehouseId,
      businessId,
      managerId,
      context,
      status,
      type,
    } = document;

    if (document.status === STATUSES.DONE && !document.doneDatetime) {
      document.doneDatetime = moment(moment(), moment.ISO_8601);
    }

    // services calculated by trigger after insert/update/delete in store_doc_services
    if (document.docProductsPassed && documentType !== DOCUMENT_TYPES.SERVICE) {
      // find sums
      let sum = 0;
      let sellingSum = 0;
      document.docProducts.forEach(product =>  {
        sum += product.stockPrice * product.quantity;
        sellingSum += product.sellingPrice * product.quantity;
      });
      document.sum = round(sum);
      document.sellingSum = round(sellingSum);
    }

    switch(context) {
      case CONTEXTS.STOCK:
        switch(documentType) {
          case DOCUMENT_TYPES.SUPPLIER:
            if (type === TYPES.INCOME) {
              if(_.get(document,'wrhAttribute') === 'STORAGE') {
                const queryWarehouse = await this._db('warehouses_tbl')
                  .select({
                    warehouseId: 'whs_id_pk',
                    warehouseName: 'whs_name',
                    warehouseAttribute: 'whs_attribute'
                  })
                  .where({
                    whs_bsn_id_fk: businessId,
                    whs_attribute: 'MAIN'
                  })
                  .first()
                
                document.warehouseId = _.get(queryWarehouse, 'warehouseId')
                document.warehouseName = _.get(queryWarehouse, 'warehouseName')
                document.wrhAttribute = _.get(queryWarehouse, 'warehouseAttribute')
              }
              for(let product of document.docProducts) {
                product.returnQuantity = product.quantity;       
              }

              document.operationCode = 'INC';
            } else {
              if(status === STATUSES.DONE) {
                let acc = 0;
                // find prices by the FIFO algorithm
                document = await this.preprocessSellingProducts(document, trx);
                document.docProducts.forEach(product => {
                  product.quantity = -Math.abs(product.quantity);
                  product.returnQuantity = Math.abs(product.quantity);
                  acc += product.stockPrice * Math.abs(product.quantity);
                });
                document.sum = acc;
              }
      
              document.operationCode = 'SRT';
            }
          break;
          case DOCUMENT_TYPES.CLIENT:
            if (type === TYPES.INCOME) {
              if(status === STATUSES.DONE) {
                for (let i = 0; i < document.docProducts.length; i++) {
                  const { avgStockPrice, avgSellingPrice, calculatedFrom, returned, orderId } = await this.storeDocProductModel.returnProducts(
                    document.docProducts[i].productId,
                    document.docProducts[i].quantity,
                    {
                      cell: document.docProducts[i].addToAddress,
                      clientId: document.counterpartClientId,
                    },
                    document.warehouseId,
                    context,
                    document.docProducts[i].storeDocProductId,
                    trx,
                    document.orderId
                  );
        
                  if (!returned) {
                    throw Boom.badRequest(`NOT_ENOUGH_PRODUCTS: ${document.docProducts[i].productId}`);
                  }
                  document.orderId = orderId;
                  if(document.autoCreated){
                    document.docProducts[i].stockPrice = avgStockPrice;
                    document.docProducts[i].sellingPrice = avgSellingPrice;
                    document.docProducts[i].calculatedFrom = JSON.stringify(calculatedFrom);
                  }
                }
              }
      
              document.operationCode = document.operationCode === 'CRA' || document.autoCreated ? 'CRA' : 'CRT';
            } else {
              if (status === STATUSES.DONE) {
                // find prices by the FIFO algorithm
                let acc = 0;
                document = await this.preprocessSellingProducts(document, trx);
                document.docProducts.forEach(product => {
                  product.quantity = -Math.abs(product.quantity);
                  product.returnQuantity = Math.abs(product.quantity);
                  acc += product.stockPrice * Math.abs(product.quantity);
                });
                document.sum = acc;
              }
              
              document.operationCode = document.operationCode === 'AUT' || document.autoCreated ? 'AUT' : 'OUT';
            }
          break;
          case DOCUMENT_TYPES.INVENTORY:
            if (type === TYPES.INCOME) {
              document.operationCode = 'STP';
            } else {
              if (status === STATUSES.DONE) {
                let acc = 0;
                document = await this.preprocessSellingProducts(document, trx);
                document.docProducts.forEach(product => {
                  product.quantity = -Math.abs(product.quantity);
                  product.returnQuantity = -product.quantity;
                  //product.sellingPrice = 0;
                  acc += product.stockPrice * Math.abs(product.quantity);
                });
                document.sum = acc;
              }
              document.operationCode = 'STM';
            }
          break;
          case DOCUMENT_TYPES.OWN_CONSUMPTION:
            if (type === TYPES.EXPENSE) {
              if (status === STATUSES.DONE) {
                let acc = 0;
                // find prices by the FIFO algorithm
                document = await this.preprocessSellingProducts(document, trx);
                document.docProducts.forEach(product => {
                  product.quantity = -Math.abs(product.quantity);
                  product.returnQuantity = Math.abs(product.quantity);
                  acc += product.stockPrice * Math.abs(product.quantity);
                });
                document.sum = acc;
              }
              document.operationCode = 'CST';
            } 
          break;
          case DOCUMENT_TYPES.SERVICE:
            // TODO only INCOME
            // there is a validation function
            if (type === TYPES.INCOME)
              document.operationCode = 'SRV';
            else if (type === TYPES.EXPENSE) {
              document.operationCode = 'VRT';
            }
            break;
          case DOCUMENT_TYPES.TRANSFER:
            const warehouse = _.get(await this.warehousesModel.getWarehouses({ businessId, id: warehouseId }, trx), '[0]');
            const counterpartWarehouse = _.get(await this.warehousesModel.getWarehouses({ businessId, id: counterpartWarehouseId }, trx), '[0]');
            if (type === TYPES.EXPENSE) { 
              if((counterpartWarehouse && counterpartWarehouse.attribute === ATTRIBUTES.RESERVE) || warehouse.attribute === ATTRIBUTES.RESERVE) {
                document.operationCode = 'RES';
              } else if((warehouse && warehouse.attribute === ATTRIBUTES.TOOL) && 
                  (counterpartWarehouse && counterpartWarehouse.attribute === ATTRIBUTES.REPAIR_AREA)) {
                document.operationCode = 'TOL';
              } else if((warehouse && warehouse.attribute === ATTRIBUTES.REPAIR_AREA) &&
                 (counterpartWarehouse && counterpartWarehouse.attribute === ATTRIBUTES.TOOL)) {
                document.operationCode = 'TOR';
              }
              else {
                document.operationCode = 'TSF';
              }


              if (status === STATUSES.DONE) {
                
                document = await this.preprocessSellingProducts(document, trx);
                document.type = 'INCOME';
                let temp = document.warehouseId; 
                document.warehouseId = document.counterpartWarehouseId;
                document.counterpartWarehouseId = temp;
                const copyStoreDoc = JSON.parse(JSON.stringify(document));
                delete copyStoreDoc.id;
                const findWhsById = await this._db('warehouses_tbl')
                    .select('whs_attribute')
                    .where('whs_id_pk', copyStoreDoc.counterpartWarehouseId)
                    .first();

                copyStoreDoc.docProducts.forEach(product => {
                  delete product.id;
                  if(findWhsById.whs_attribute === 'REPAIR_AREA'){
                    product.addToAddress = product.transferRepairAreaToCell;
                  }
                  delete product.getFromAddress;
                })
                await this.create({ 
                  ...copyStoreDoc, 
                  businessId, 
                  managerId, 
                  ignoreTypeValidation: true 
                },trx);

                
        
                document.type = 'EXPENSE';
                temp = document.warehouseId; 
                document.warehouseId = document.counterpartWarehouseId;
                document.counterpartWarehouseId = temp;

                document.docProducts.forEach(product => {
                  product.quantity = -Math.abs(product.quantity);
                  //product.sellingPrice = 0;
                  delete product.id;
                  delete product.addToAddress;
                });
              }
            }
          break;
          case DOCUMENT_TYPES.PRESERVATION:
            if (type === TYPES.INCOME) {
              // counterpartClientId
              // counterpartBusinessSupplierId
              document.operationCode = 'KPP';
            } else {
              if(status === STATUSES.DONE) {
                let acc = 0;
                document.docProducts.forEach(product => {
                  product.quantity = -Math.abs(product.quantity);
                  product.returnQuantity = Math.abs(product.quantity);
                  acc += product.stockPrice * Math.abs(product.quantity);
                });
                document.sum = acc;
              }
              document.operationCode = 'KPM';
            }
          break;
        }
      break;
      case CONTEXTS.ORDER:
        switch(documentType) {
          case ORDER_DOCUMENT_TYPES.ADJUSTMENT:
            if (type === TYPES.EXPENSE) {
              if (status === STATUSES.DONE) {
                for (let i = 0; i < document.docProducts.length; i++) {
                  const { avgStockPrice, avgSellingPrice, calculatedFrom, returned } = await this.storeDocProductModel.returnProducts(
                    document.docProducts[i].productId,
                    document.docProducts[i].quantity,
                    { businessSupplierId: document.counterpartBusinessSupplierId },
                    null,
                    context,
                    null,
                    trx,
                  );
                  
                  if (!returned) {
                    throw Boom.badRequest(`NOT_ENOUGH_PRODUCTS: ${document.docProducts[i].productId}`);
                  }
        
                  document.docProducts[i].quantity = -Math.abs(document.docProducts[i].quantity);
                  document.docProducts[i].stockPrice = avgStockPrice;
                  document.docProducts[i].sellingPrice = avgSellingPrice;
                  document.docProducts[i].calculatedFrom = JSON.stringify(calculatedFrom);
                }
        
                //await findFIFOPrices(document.docProducts, this.storeDocProductModel, null, context, null, businessId);
              }
              document.operationCode = 'BOR';
            }
          break;
          case ORDER_DOCUMENT_TYPES.SUPPLIER:
            if (type === TYPES.INCOME) {
              document.docProducts.forEach(product => {
                product.returnQuantity = product.quantity;
              });
              document.operationCode = 'ORD';
            } else {
              document.operationCode = 'COM';
              if (status === STATUSES.DONE) {
                if (!document.warehouseId){
                  document.warehouseId = (await this.warehousesModel.getWarehouses({attribute: 'MAIN', businessId}))[0].id;
                }
                document.context = CONTEXTS.STOCK;
                document.type = TYPES.INCOME;
                document.operationCode = 'INC';

                const copyStoreDoc = JSON.parse(JSON.stringify(document));
                
                let insertDoc = await this.create({
                    ...copyStoreDoc,
                    businessId,
                    managerId,
                  }, trx, true);

                if(insertDoc.businessSupplierRequisiteId){
                      const query = await this._db('business_suppliers_requisites_tbl')
                        .select(this._db.raw('coalesce(bsr_tax_rate, 0) as "businessRequisite"'))
                        .where('bsr_id_pk', insertDoc.businessSupplierRequisiteId)
                        .where('bsr_is_tax_payer', true)
                        .first()

                      if(query){
                        insertDoc.sellingSum = insertDoc.sellingSum * (1 + query.businessRequisite / 100);
                      } else {
                        insertDoc.sellingSum = insertDoc.sellingSum;
                      }
                }


                await this.insertPreprocessDocuments(insertDoc);

                document.context = CONTEXTS.ORDER;
                document.type = TYPES.EXPENSE;
                document.operationCode = 'COM';

                for (let i = 0; i < document.docProducts.length; i++) {
                  const { avgStockPrice, avgSellingPrice, calculatedFrom, returned } = await this.storeDocProductModel.returnProducts(
                    document.docProducts[i].productId,
                    document.docProducts[i].quantity,
                    { businessSupplierId: document.counterpartBusinessSupplierId },
                    null,
                    context,
                    null,
                    trx,
                  );
                  
                  if (!returned) {
                    throw Boom.badRequest(`NOT_ENOUGH_PRODUCTS: ${document.docProducts[i].productId}`);
                  }
                  
                  document.docProducts[i].quantity = Math.abs(calculatedFrom[0].quantity);
                  document.docProducts[i].returnQuantity = calculatedFrom[0].quantity;
                  // document.docProducts[i].stockPrice = avgStockPrice; //- commented to let the user change the stockPrice on creating docs
                  document.docProducts[i].sellingPrice = avgSellingPrice;
                  document.docProducts[i].calculatedFrom = JSON.stringify(calculatedFrom);
                }

                document.docProducts.forEach(docProduct => {
                  docProduct.quantity = -docProduct.quantity;
                  docProduct.returnQuantity = 0;
                })
                document.context = CONTEXTS.ORDER;
                document.type = TYPES.EXPENSE;
                document.operationCode = 'COM';  
              }
            }
          break;
        }
      break;
    }

    return document;
  }

  async preprocessSellingProducts(document, trx) {
    const {
      warehouseId,
      context,
      orderId,
    } = document;

    // Here we are groupping the products by their ids and cells
    const balance = [];
    document.docProducts.reduce(function(res, value) {
      if (!_.get(res, `[${value.productId}][${value.getFromAddress}]`)) {
        res[value.productId] = {};
        res[value.productId][value.getFromAddress] = { ...value, quantity: 0 };
        balance.push(res[value.productId][value.getFromAddress])
      }
      res[value.productId][value.getFromAddress].quantity += value.quantity;
      return res;
    }, {});

    // Here we are finding a list that contains all incomes that are not used yet in FIFO
    for (let product of balance) {
      const filters = {
        cell: product.getFromAddress,
        warehouseId,
        productId: product.productId,
        context,
        // orderId,
      };

      let availableQuantity = await this.storeDocProductModel.countAvailable(filters, trx)
      const allIncomes = await this.storeDocProductModel.getIncomeList(filters, trx);
      product.availableQuantity = availableQuantity;
      product.inc = [];

      for (let i = allIncomes.length-1; i >= 0; i--) {
        allIncomes[i].quantity = round(parseFloat(allIncomes[i].quantity));
        // inc - available incomes
        if (allIncomes[i].quantity < availableQuantity) {
          product.inc.unshift(allIncomes[i]);
          availableQuantity -= round(allIncomes[i].quantity);
        } else if (allIncomes[i].quantity >= availableQuantity && availableQuantity !== 0) {
          product.inc.unshift({ ...allIncomes[i], quantity: round(availableQuantity) });
          break;
        }
      }
    }
    
    // Here we are calculating the price by FIFO
    for (let i = 0; i < document.docProducts.length; i++) {
      const {
        takeAvailable,
        getFromAddress,
        productId,
      } = document.docProducts[i];
      let { quantity } = document.docProducts[i];

      const ind = _.findIndex(balance, (x) => x.productId === productId && x.getFromAddress === getFromAddress);
      let sum = 0;
      
      if (takeAvailable) {
        if (balance[ind].availableQuantity < quantity) {
          document.docProducts[i].quantity = balance[ind].availableQuantity;
          quantity = balance[ind].availableQuantity;
        }
      }

      const { quantity: originalQuantity } = document.docProducts[i];

      for (let j = 0; j < balance[ind].inc.length; j++) {
        quantity = round(quantity);
        balance[ind].inc[j].quantity = round(balance[ind].inc[j].quantity);
        if (balance[ind].inc[j].quantity < quantity) {
          sum += balance[ind].inc[j].quantity * balance[ind].inc[j].purchasePrice;
          quantity -= balance[ind].inc[j].quantity;
          balance[ind].inc[j].quantity = 0;

        } else if (balance[ind].inc[j].quantity >= quantity) {
          sum += quantity * balance[ind].inc[j].purchasePrice;
          balance[ind].inc[j].quantity -= quantity;
          break;
        }
      }

      document.docProducts[i].stockPrice = round(sum / originalQuantity);
    }
    
    return document;
  }

  async getReturnableDocs(filters) {
    const {
      documentType,
      productId,
      businessId,
      counterpartBusinessSupplierId,
      counterpartClientId,
    } = filters;

    const query = this._db('store_docs_tbl')
      .select(
        this._db.raw(`std_operation_code ||'-'|| std_bsn_id_fk ||'-'|| std_id_pk as "documentNumber"`),

        'std_id_pk as id',
        'std_type as type',
        'std_document_type as documentType',
        'std_environment as context',
        'std_supplier_doc_number as supplierDocNumber',
       
        'std_done_datetime as doneDatetime',
        'std_sum as sum',
        'std_selling_sum as sellingSum',
        'std_mng_id_fk as managerId',
        'std_whs_id_fk as warehouseId',
        'std_counterpart_bsp_id_fk as counterpartBusinessSupplierId',
        'std_counterpart_cln_id_fk as counterpartClientId',
        'std_counterpart_whs_id_fk as counterpartWarehouseId',

        'sdp_id_pk as storeDocProductId',
        'sdp_stp_id_fk as productId', 
        'sdp_return_quantity as returnQuantity', 
        'sdp_stock_price as stockPrice',
        'sdp_selling_price as sellingPrice',

      )
      .innerJoin('store_doc_products_tbl', function() {
        this.on('sdp_std_id_fk', 'std_id_pk')
        .andOn('sdp_stp_id_fk', productId);
      })
      .where('std_bsn_id_fk', businessId)
      .where('std_type', documentType === 'SUPPLIER' ? 'INCOME' : 'EXPENSE')
      .where('std_document_type', documentType)
      .where('std_status', 'DONE')
      .whereRaw('sdp_return_quantity > 0')
      .orderBy('std_id_pk');

    if (counterpartBusinessSupplierId) {
      query.where('std_counterpart_bsp_id_fk', counterpartBusinessSupplierId);
    }
    if (counterpartClientId) {
      query.where('std_counterpart_cln_id_fk', counterpartClientId);
    }

    return await query;
  }

  async dropReserves(options) {
    const {
      productIds,
      businessId,
      managerId,
    } = options;

    return await this._db.transaction(async trx => {
      if (process.env.DISABLE_ISOLATION_SETTING != 'yes')
        await trx.raw('set transaction isolation level read uncommitted;');

      // 1. видалити всі товари X з руху комірок
      await this.wmsModel.delete(options, trx);

      // 2. видалити всі рядки документа з кодом RES, де товар Х
      const resDocProductsQuery = trx('store_doc_products_tbl')
        .select('sdp_id_pk as id')
        .leftJoin('store_docs_tbl', 'std_id_pk', 'sdp_std_id_fk')
        .where('std_operation_code', 'RES')
        .where('std_status', 'DONE')
        .where('std_bsn_id_fk', businessId);
        
      if (productIds) {
        resDocProductsQuery.whereIn('sdp_stp_id_fk', productIds);
      }

      const resdDocIds = (await resDocProductsQuery).map(x => x.id);
      await trx('store_doc_products_tbl')
        .delete()
        .whereIn('sdp_id_pk', resdDocIds);

      // 3. пройтися по всім рядкам документа, де товар Х, від початку до кінця:
      const productsWithCellsQuery = trx('store_doc_products_tbl')
        .select(
          'std_id_pk as storeDocId',
          'std_whs_id_fk as warehouseId',
          'sdp_stp_id_fk as storeProductId',
          'sdp_quantity as count',
          'sdp_add_address_ref as addToAddress',
          trx.raw(`(
          	select 1 
          	from wms_cell_options_tbl 
          	where wco_bsn_id_fk = std_bsn_id_fk 
          		and wco_address = sdp_add_address_ref limit 1) as "addToAddressAvailable"`),
          'sdp_get_address_ref as getFromAddress',
          trx.raw(`(
          	select 1 
          	from wms_cell_options_tbl 
          	where wco_bsn_id_fk = std_bsn_id_fk 
          		and wco_address = sdp_get_address_ref limit 1) as "getFromAddressAvailable"`),
        )
        .leftJoin('store_docs_tbl', 'sdp_std_id_fk', 'std_id_pk')
        .where('std_bsn_id_fk', businessId)
        .where('std_status', 'DONE')
        .whereRaw('(sdp_add_address_ref is not null or sdp_get_address_ref is not null)')
        .orderBy(trx.raw('std_type desc, sdp_id_pk'));

      if (productIds) {
        productsWithCellsQuery.whereIn('sdp_stp_id_fk', productIds);
      }

      const productsWithCells = await productsWithCellsQuery;
      for (let productWithCells of productsWithCells) {
        const {
          getFromAddressAvailable,
          addToAddressAvailable,
          storeProductId,
          getFromAddress,
          addToAddress,
          warehouseId,
          storeDocId,
          count,
        } = productWithCells;

        // a. додавати в комірки, якщо вказано
        if (addToAddress && addToAddressAvailable) {
          await this.wmsModel.addProductsToCells({ businessId, managerId }, 
            [{
              warehouseId,
              storeProductId,
              address: addToAddress,
              count: Math.abs(parseFloat(count)),
              storeDocId,
            }], trx);
        }
        
        // b. видаляти з комірки, якщо вказано
        if (getFromAddress && getFromAddressAvailable) {
          await this.wmsModel.removeProductsFromCells({ businessId, managerId }, 
            [{
              warehouseId,
              storeProductId,
              address: getFromAddress,
              count: Math.abs(count),
              storeDocId,
            }], trx);
        }
      }

      // 4. пройтися по всім деталям н/з, де товар Х, і зняти резерви
      await this.triggerOrderDetailUpdate(trx, { filterBy: 'BUSINESS', businessId, productIds });

      return true;
    });
  }

  async getReserves(options) {
    const {
      businessId,
      warehouseId,
      productId,
      startDate,
      endDate,
      page,
      pageSize
    } = options;


    const query = this._db.raw(`
      select
          sum(sdp_quantity) as quantity,
          (array_agg(std_done_datetime))[1] as datetime,
          std_ord_id_fk as "orderId",
          sdp_stp_id_fk as "productId",
          array_agg(std_id_pk) as "docIds",
          null as "purchasePrice",
          null as "purchaseSum",
          null as "sellingPrice",
          null as "sellingSum",
          null as "expenseFromId",
          null as "doc",
          null as "order",
          (select sum(oap_count::int) from orders_simple_appurtenancies_tbl
            where oap_ord_id_fk = std_ord_id_fk and oap_stp_id_fk = sdp_stp_id_fk)::int as count
        from store_doc_products_tbl
        inner join store_docs_tbl on sdp_std_id_fk = std_id_pk
        left join warehouses_tbl on whs_id_pk = std_whs_id_fk
        where std_bsn_id_fk = ${businessId} and std_status = 'DONE'
        and std_operation_code in ('RES')
        ${productId ? `and sdp_stp_id_fk = ${productId}`: ''}
        ${warehouseId ? `and std_counterpart_whs_id_fk = ${warehouseId}`: ''}
      and whs_attribute='RESERVE'
        group by 3,4
      having sum(sdp_quantity) > 0
       ${startDate ? `and DATE((array_agg(std_done_datetime))[1]) >= '${startDate}'` : '' }
       ${endDate ? `and DATE((array_agg(std_done_datetime))[1]) <= '${endDate}'` : '' } 
      limit ${pageSize} offset ${(page - 1) * pageSize}
    `);

    const reserves = (await query).rows;

    for (let i = 0; i < reserves.length; i++) {
      reserves[i].product = await this.storeProductModel.get({id: reserves[i].productId, businessId });
      reserves[i].brandId = reserves[i].product.brandId;
    }

    return { stats: { count: reserves.length }, list: reserves };
  }

  async getListWithStats(options) {
    const [stats, list] = await Promise.all([
      this.getStats(options),
      this.getList(options),
    ]);

    return { stats, list }; 
  }

  /**
   * Get query to generate store doc list. This can be used to make more calculations 
   * on resulting query from other places.
   * @param {*} options.sumRemains - only store docs with debts
   * @param {*} options.page
   * @param {*} options.pageSize
   */
  getStoreDocsListQuery(options) {
    const { page, sumRemains, pageSize } = options;

    const query = this._db(this.table)
      .select(
        this._db.raw(`std_operation_code ||'-'|| std_bsn_id_fk ||'-'|| std_id_pk as "documentNumber"`),

        'std_id_pk as id',
        'std_type as type',
        'std_comment as comment',
        'std_environment as context',
        'std_status as status',
        'std_supplier_doc_number as supplierDocNumber',
        'std_created_datetime as createdDatetime',
        'std_done_datetime as doneDatetime',
        'std_record_datetime as recordDatetime',
        'std_paid_datetime as paidDatetime',
        'std_bsp_id_fk as businessSupplierId',
        'std_sum as sum',
        'std_selling_sum as sellingSum',
        'std_bsn_id_fk as businessId',
        'std_mng_id_fk as managerId',
        'std_whs_id_fk as warehouseId',
        'std_document_type as documentType',
        'std_supplier_doc_number as docNumber',
        'std_counterpart_bsp_id_fk as counterpartBusinessSupplierId',
        'std_counterpart_cln_id_fk as counterpartClientId',
        'std_counterpart_whs_id_fk as counterpartWarehouseId',
        'std_counterpart_eml_id_fk as counterpartEmployeeId',

        this._db.raw(`
          
            JSON_BUILD_OBJECT (
                'id', mng_id_pk,
                'name', mng_name,
                'surname', mng_surname,
                'employeeId', mng_eml_id_fk
            )
           AS manager`
        ),

        'warehouse.whs_name as warehouseName',
        'bsp_name as counterpartBusinessSupplierName',
        this._db.raw(`TRIM(CONCAT(cln_name, ' ', cln_surname))  as "counterpartClientName"`),
        this._db.raw(`TRIM(CONCAT(eml_name, ' ', eml_surname)) as "counterpartEmployeeName"`),
        'counterpart_whs.whs_name as counterpartWarehouseName',
        'std_pay_until_datetime as payUntilDatetime',
        'bct_barcode as barcode',

        'std_external_api_order_status as externalApiOrderStatus',
        'std_external_api_doc_id as externalApiDocId',
        'std_external_api_expense_doc_id as externalApiExpenseDocId',

        this._db.raw(`
          case 
          when (std_operation_code = 'TSF' or std_operation_code = 'TOL' or std_operation_code = 'TOR') and std_status = 'NEW' then std_whs_id_fk
          when (std_operation_code = 'TSF' or std_operation_code = 'TOL' or std_operation_code = 'TOR') and std_type = 'INCOME' then null
          when (std_operation_code = 'TSF' or std_operation_code = 'TOL' or std_operation_code = 'TOR') and std_type = 'EXPENSE' then std_whs_id_fk
          else std_whs_id_fk 
          end 
          as "warehouseId"`),
        this._db.raw(`
          case 
          when (std_operation_code = 'TSF' or std_operation_code = 'TOL' or std_operation_code = 'TOR') and std_status = 'NEW' then std_counterpart_whs_id_fk
          when (std_operation_code = 'TSF' or std_operation_code = 'TOL' or std_operation_code = 'TOR') and std_type = 'INCOME' then std_whs_id_fk 
          when (std_operation_code = 'TSF' or std_operation_code = 'TOL' or std_operation_code = 'TOR') and std_type = 'EXPENSE' then null
          else std_counterpart_whs_id_fk 
          end 
          as "counterpartWarehouseId"`),
        this._db.raw(`
          case 
          when (std_operation_code = 'TSF' or std_operation_code = 'TOL' or std_operation_code = 'TOR') and std_status = 'NEW' then warehouse.whs_name
          when (std_operation_code = 'TSF' or std_operation_code = 'TOL' or std_operation_code = 'TOR') and std_type = 'INCOME' then null 
          when (std_operation_code = 'TSF' or std_operation_code = 'TOL' or std_operation_code = 'TOR') and std_type = 'EXPENSE' then warehouse.whs_name
          when std_operation_code != 'TSF' then warehouse.whs_name
          
          end 
          as "warehouseName"`),
        this._db.raw(`
          case 
          when (std_operation_code = 'TSF' or std_operation_code = 'TOL' or std_operation_code = 'TOR') and std_status = 'NEW' then counterpart_whs.whs_name
          when (std_operation_code = 'TSF' or std_operation_code = 'TOL' or std_operation_code = 'TOR') and std_type = 'INCOME' then warehouse.whs_name 
          when (std_operation_code = 'TSF' or std_operation_code = 'TOL' or std_operation_code = 'TOR') and std_type = 'EXPENSE' then null
          when std_operation_code != 'TSF' then counterpart_whs.whs_name
          end 
          as "counterpartWarehouseName"`),
        
        
      )
      .select(this._db.raw(`
              round(coalesce((
                case 
                  when std_type = 'EXPENSE' AND std_document_type = 'CLIENT' AND std_status = 'NEW' AND std_operation_code = 'OUT' then
                    abs(std_selling_sum) 
                    * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
                    - coalesce((${docPaidSumPositive()} - ${docPaidSumNegative()}), 0)

                  when std_type = 'EXPENSE' AND std_document_type = 'CLIENT' AND std_status = 'DONE' AND std_operation_code = 'OUT' then
                    coalesce(${docPaidSumDone()}, 0)

                  when std_type = 'INCOME' AND std_document_type = 'SUPPLIER' AND std_status = 'DONE' AND std_operation_code in('INC', 'SRV') then
                    coalesce(${docPaidSumDone()}, 0)
                  
                  when std_type = 'INCOME' AND std_document_type = 'SUPPLIER' AND std_status = 'NEW' AND std_operation_code in('INC', 'SRV') then
                    (case when (std_operation_code = 'SRV') then 
                      abs(std_sum)
                      * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
                      - coalesce((${docPaidSumPositive()} - ${docPaidSumNegative()}), 0)
                      else
                      abs(std_selling_sum) 
                      * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
                      - coalesce((${docPaidSumPositive()} - ${docPaidSumNegative()}), 0)
                      end)

                  when std_type = 'EXPENSE' AND std_document_type = 'SUPPLIER' AND std_status = 'NEW' AND std_operation_code = 'SRT' then
                        abs(std_selling_sum) 
                        * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
                        - coalesce((${docPaidSumPositive()} - ${docPaidSumNegative()}), 0)

                  when std_type = 'EXPENSE' AND std_document_type = 'SUPPLIER' AND std_status = 'DONE' AND std_operation_code = 'SRT' then
                    coalesce(${docPaidSumDone()},0)

                  when std_type = 'INCOME' AND std_document_type = 'CLIENT' AND std_status = 'NEW' AND std_operation_code = 'CRT'  then
                    abs(std_selling_sum) 
                    * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
                    - coalesce((${docPaidSumPositive()} - ${docPaidSumNegative()}), 0)

                  when std_type = 'INCOME' AND std_document_type = 'CLIENT' AND std_status = 'DONE' AND std_operation_code = 'CRT'  then
                    coalesce(${docPaidSumDone()},0)

                  when std_type = 'INCOME' AND std_document_type = 'CLIENT' AND std_operation_code = 'CRA' then
                    abs(std_selling_sum) 
                    * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
                    + ${paidSum('std_id_pk', 'std_document_type')}

                  when std_type = 'INCOME' AND std_document_type = 'CLIENT'  then
                    abs(std_selling_sum) 
                    * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
                    + ${paidSum('std_id_pk', 'std_document_type')}
          
                  when std_type = 'EXPENSE' AND std_document_type = 'CLIENT' then
                  (case when ( std_operation_code = 'AUT') then 
                    abs(std_selling_sum) 
                    * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
                    - ${paidSum('std_id_pk', 'std_document_type')}
                  else
                    abs(std_selling_sum) 
                    * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
                    - ${paidSum('std_id_pk', 'std_document_type')}
                  end)

                  when std_type = 'EXPENSE' AND std_document_type = 'CLIENT' then
                    abs(std_selling_sum) 
                    * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
                    - ${paidSum('std_id_pk', 'std_document_type')}

                  when std_type = 'EXPENSE' AND std_document_type = 'OWN_CONSUMPTION' then
                    (case when (std_operation_code = 'CST') then 
                      abs(std_selling_sum) 
                      + ${paidSum('std_id_pk', 'std_document_type')}
                    else
                      abs(std_selling_sum) 
                      * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
                      + ${paidSum('std_id_pk', 'std_document_type')}
                    end)
                    
                  
                  when std_type = 'EXPENSE' AND std_document_type = 'SUPPLIER' then
                    (case when ( std_operation_code = 'SRT') then 
                      abs(std_selling_sum) 
                      * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
                      - ${paidSum('std_id_pk', 'std_document_type')}
                    else 
                      abs(std_selling_sum) 
                      * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
                      - ${paidSum('std_id_pk', 'std_document_type')}
                    end)

          
                  when std_type = 'INCOME' AND std_document_type = 'SUPPLIER' then
                      abs(std_selling_sum) 
                      * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
                      + ${paidSum('std_id_pk', 'std_document_type')}

                  when std_type = 'INCOME' AND std_document_type = 'INVENTORY' then
                      abs(std_selling_sum) 
                      * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
                      + ${paidSum('std_id_pk', 'std_document_type')}

                  when std_type = 'INCOME' AND std_document_type = 'SERVICE' then
                      (case when (std_operation_code = 'SRV') then 
                        abs(std_sum)
                        * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
                        + ${paidSum('std_id_pk', 'std_document_type')}
                      else
                        abs(std_selling_sum) 
                        * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
                        + ${paidSum('std_id_pk', 'std_document_type')}
                      end)

                  when std_type = 'INCOME' then
                      abs(std_selling_sum) 
                      * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
                      + ${paidSum('std_id_pk', 'std_document_type')}

                  when std_type = 'EXPENSE' and std_document_type = 'ADJUSTMENT' then
                      abs(std_selling_sum) 
                      * (case when bsr_is_tax_payer IS TRUE then (1 + bsr_tax_rate::float/100) else 1 end)
                      + ${paidSum('std_id_pk', 'std_document_type')}

                  when std_type = 'EXPENSE' AND std_document_type = 'INVENTORY' then
                  (case when (std_operation_code = 'STM') then 
                    abs(std_selling_sum)
                  else
                    abs(std_selling_sum) 
                    * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
                    + ${paidSum('std_id_pk', 'std_document_type')}
                  end)

                  when std_type = 'EXPENSE' AND std_document_type = 'TRANSFER' then
                      abs(std_selling_sum)
                      + ${paidSum('std_id_pk', 'std_document_type')}
                  
                  when std_type = 'EXPENSE' then
                      abs(std_selling_sum) 
                      * (case when rqt_is_tax_payer IS TRUE then (1 + rqt_tax_rate::float/100) else 1 end)
                      + ${paidSum('std_id_pk', 'std_document_type')}
          
                  else 0
                end
              ), 0)::numeric, 2)::float as "remainingSum"
      `))
      // .select(this._db.raw(`${remainingSumQuery()} as "remainingSum"`))
      .select(this._db.raw(`abs((select sum(round(round(sdp_stock_price::numeric, 2)*sdp_quantity, 2)) from store_doc_products_tbl where sdp_std_id_fk = store_docs_tbl.std_id_pk)::float) as sum`))
      .select(this._db.raw(`abs((select sum(round(round(sdp_selling_price::numeric, 2)*sdp_quantity, 2)) from store_doc_products_tbl where sdp_std_id_fk = store_docs_tbl.std_id_pk)::float) as "sellingSum"`))
      .select(this._db.raw(`std_sum as totalSum`))
      .leftJoin('managers_tbl', 'mng_id_pk', 'std_mng_id_fk')
      .leftJoin('business_suppliers_tbl', 'std_counterpart_bsp_id_fk', 'bsp_id_pk')
      .leftJoin('clients_tbl', 'std_counterpart_cln_id_fk', 'cln_id_pk')
      .leftJoin(this._db.raw('warehouses_tbl as counterpart_whs on std_counterpart_whs_id_fk = counterpart_whs.whs_id_pk'))
      .leftJoin(this._db.raw('warehouses_tbl as warehouse on std_whs_id_fk = warehouse.whs_id_pk'))
      .leftJoin('employees_tbl', 'std_counterpart_eml_id_fk', 'eml_id_pk')
      .leftJoin('requisites_tbl', 'std_rqt_id_fk', 'rqt_id_pk')
      .leftJoin('business_suppliers_requisites_tbl', 'std_bsr_id_fk', 'bsr_id_pk')
      .leftJoin('clients_requisites_tbl', 'std_crq_id_fk', 'crq_id_pk')
      .leftJoin(this._db.raw(`barcodes_tbl on bct_ref_id::int = std_id_pk and bct_table = 'STORE_DOCS'`))
      .orderBy(TO_DB.createdDatetime, 'desc')
      .groupBy(
          'std_id_pk',
          'mng_id_pk',
          'warehouse.whs_name',
          'bsp_name',
          'cln_name',
          'cln_surname',
          'counterpart_whs.whs_name',
          'eml_name',
          'eml_surname',
          'bct_barcode',
          'bsr_is_tax_payer',
          'crq_is_tax_payer',
          'rqt_is_tax_payer',
          'bsr_tax_rate',
          'rqt_tax_rate',
      );

    this.applyFilters(query, options);

    const resultingQuery = this._db
      .select('*')
      .with('resulting_query', query)
      .from('resulting_query');
    
    if(sumRemains) {
      resultingQuery.whereRaw('"remainingSum" <> 0');
    }

    if (page) {
      resultingQuery.limit(pageSize).offset((page - 1) * pageSize);
    }
    return resultingQuery;
  }

  /**
   * Get list of store docs with filters applied
   * @param {*} options - filters
   * @returns - list of store docs
   */
  async getList(options) {
    const list = await this.getStoreDocsListQuery(options);

    return list;
  }

  /**
   * Get store docs statistics based on provided filters.
   * @param {*} options - filters
   * @returns statistics object
   */
  async getStats(options) {
    const query = this._db(this.table)
    .select(
      this._db.raw(`std_operation_code ||'-'|| std_bsn_id_fk ||'-'|| std_id_pk as "documentNumber"`),

      'std_id_pk as id',
      'std_type as type',
      'std_comment as comment',
      'std_environment as context',
      'std_status as status',
      'std_supplier_doc_number as supplierDocNumber',
      'std_created_datetime as createdDatetime',
      'std_done_datetime as doneDatetime',
      'std_record_datetime as recordDatetime',
      'std_paid_datetime as paidDatetime',
      'std_bsp_id_fk as businessSupplierId',
      'std_sum as sum',
      'std_selling_sum as sellingSum',
      'std_bsn_id_fk as businessId',
      'std_mng_id_fk as managerId',
      'std_whs_id_fk as warehouseId',
      'std_document_type as documentType',
      'std_supplier_doc_number as docNumber',
      'std_counterpart_bsp_id_fk as counterpartBusinessSupplierId',
      'std_counterpart_cln_id_fk as counterpartClientId',
      'std_counterpart_whs_id_fk as counterpartWarehouseId',
      'std_counterpart_eml_id_fk as counterpartEmployeeId',

      'warehouse.whs_name as warehouseName',
      'bsp_name as counterpartBusinessSupplierName',
      this._db.raw(`cln_name ||' '|| cln_surname as "counterpartClientName"`),
      'counterpart_whs.whs_name as counterpartWarehouseName',
      this._db.raw(`eml_name ||' '|| eml_surname as "counterpartEmployeeName"`),
      'std_pay_until_datetime as payUntilDatetime',
      'bct_barcode as barcode',

      'std_external_api_order_status as externalApiOrderStatus',
      'std_external_api_doc_id as externalApiDocId',
      'std_external_api_expense_doc_id as externalApiExpenseDocId',
    )
    .select(this._db.raw(`${remainingSumQuery()} as "remainingSum"`))
    .leftJoin(this._db.raw('warehouses_tbl as warehouse on std_whs_id_fk = warehouse.whs_id_pk'))
    .leftJoin('managers_tbl', 'mng_id_pk', 'std_mng_id_fk')
    .leftJoin('business_suppliers_tbl', 'std_counterpart_bsp_id_fk', 'bsp_id_pk')
    .leftJoin('clients_tbl', 'std_counterpart_cln_id_fk', 'cln_id_pk')
    .leftJoin('requisites_tbl', 'std_rqt_id_fk', 'rqt_id_pk')
    .leftJoin(this._db.raw('warehouses_tbl as counterpart_whs on std_counterpart_whs_id_fk = counterpart_whs.whs_id_pk'))
    .leftJoin('employees_tbl', 'std_counterpart_eml_id_fk', 'eml_id_pk')
    .leftJoin(this._db.raw(`barcodes_tbl on bct_ref_id::int = std_id_pk and bct_table = 'STORE_DOCS'`))
    .leftJoin('business_suppliers_requisites_tbl', 'std_bsr_id_fk', 'bsr_id_pk')
    .leftJoin('clients_requisites_tbl', 'std_crq_id_fk', 'crq_id_pk')
    .orderBy(TO_DB.createdDatetime, 'desc')
    .groupBy(
        'std_id_pk',
        'mng_id_pk',
        'warehouse.whs_name',
        'bsp_name',
        'cln_name',
        'cln_surname',
        'counterpart_whs.whs_name',
        'eml_name',
        'eml_surname',
        'bct_barcode',
        'bsr_is_tax_payer',
        'crq_is_tax_payer',
        'rqt_is_tax_payer',
        'bsr_tax_rate',
        'rqt_tax_rate',
    );
      
    this.applyFilters(query, options);

    const resultingQuery = this._db
      .count()
      .with('resulting_query', query)
      .from('resulting_query')
      .first();

    //Remove store docs with remaining sum
    if(_.get(options, 'sumRemains')) {
      resultingQuery.whereRaw('"remainingSum" <> 0');
    }
    
    const stats = await resultingQuery;
    return stats;
  }

  /**
   * Get store docs groupped statistics based on provided filters.
   * @param {*} options - filters
   * @returns statistics object
   */
  async getGrouppedStats(options) {
      const query = this._db(this.table)
        .select()
        .leftJoin('business_suppliers_tbl', 'bsp_id_pk', 'std_bsp_id_fk')
        .leftJoin('requisites_tbl', 'std_rqt_id_fk', 'rqt_id_pk')
        .leftJoin('business_suppliers_requisites_tbl', 'std_bsr_id_fk', 'bsr_id_pk')
        .leftJoin('clients_requisites_tbl', 'std_crq_id_fk', 'crq_id_pk')
        .leftJoin('managers_tbl', 'mng_id_pk', 'std_mng_id_fk')
        .leftJoin('clients_tbl', 'cln_id_pk', 'std_counterpart_cln_id_fk')
        .leftJoin('employees_tbl', 'eml_id_pk', 'std_counterpart_eml_id_fk')
        .leftJoin(this._db.raw(`barcodes_tbl on bct_ref_id::int = std_id_pk and bct_table = 'STORE_DOCS'`));
        
      this.applyFilters(query, options);
  
      const resultingQuery = this._db
        .select('std_operation_code as operationCode')
        .count()
        .with('resulting_query', query)
        .from('resulting_query')
        .groupBy('std_operation_code')
        .orderBy('std_operation_code');
  
      //Remove store docs with remaining sum
      if(_.get(options, 'sumRemains')) {
        resultingQuery.whereRaw('"remainingSum" <> 0');
      }
      
      const stats = await resultingQuery;
      const statsObj = {};
      stats.forEach(stat => {
        statsObj[stat.operationCode] = stat.count;
      })
      return statsObj;
  }

  applyFilters(query, options) {
    const {
      type,
      status,
      query: searchQuery,
      createdDatetime,
      doneDatetime,
      recordDatetime,
      paidDatetime,
      startDate,
      endDate,
      businessId,
      documentType,
      context,
      counterpartBusinessSupplierId,
      counterpartClientId,
      counterpartWarehouseId,
      warehouseId,
      storeDocId,

      contexts,
      documentTypes,
      operationCodes,
      types,
      statuses,
      productIds,
      productId,
      orderId,
      clientId,
    } = options;

    if (businessId) {
      query.where(TO_DB.businessId, businessId);
    }
    
    if (type) {
      query.where(TO_DB.type, type);
    }
    if (types) {
      query.whereIn(TO_DB.type, types);
    }

    if (status) {
      query.where(TO_DB.status, status);
    }
    if (statuses) {
      query.whereIn(TO_DB.status, statuses);
    }

    if (createdDatetime) {
      query.where(
        this._db.raw(TO_DB.createdDatetime + '::date'),
        '=',
        createdDatetime
      );
    }
    if (doneDatetime) {
      query.where(
        this._db.raw(TO_DB.doneDatetime + '::date'),
        '=',
        doneDatetime
      );
    }
    if (recordDatetime) {
      query.where(
        this._db.raw(TO_DB.recordDatetime + '::date'),
        '=',
        recordDatetime
      );
    }
    if (paidDatetime) {
      query.where(
        this._db.raw(TO_DB.paidDatetime + '::date'),
        '=',
        paidDatetime
      );
    }
    if (startDate) {
      query.where(
        this._db.raw(TO_DB.createdDatetime + '::date'),
        '>=',
        startDate
      );
    }
    if (endDate) {
      query.where(
        this._db.raw(TO_DB.createdDatetime + '::date'),
        '<=',
        endDate
      );
    }
    
    if (searchQuery) {
      const escapedSearchQuery = escapeStringRegexp(searchQuery);

      query.andWhere(function() {
        this.where('bsp_name', '~*', escapedSearchQuery)
          .orWhereRaw('std_id_pk::varchar ~* :escapedSearchQuery', {
            escapedSearchQuery,
          })
          .orWhere('mng_surname', '~*', escapedSearchQuery)
          .orWhere('mng_name', '~*', escapedSearchQuery)

          .orWhere('cln_name', '~*', escapedSearchQuery)
          .orWhere('cln_surname', '~*', escapedSearchQuery)
          .orWhere('eml_name', '~*', escapedSearchQuery)
          .orWhere('eml_surname', '~*', escapedSearchQuery)
          .orWhere('bct_barcode', '~*', escapedSearchQuery)
          .orWhere('std_operation_code', '~*', escapedSearchQuery)

          .orWhere('std_supplier_doc_number', '~*', escapedSearchQuery)
          .orWhereRaw("std_operation_code ||'-'|| std_bsn_id_fk ||'-'|| std_id_pk ~* :escapedSearchQuery", {escapedSearchQuery});
      });
    }

    if (documentType) {
      query.where(TO_DB.documentType, documentType);
    }

    if (documentTypes) {
      query.whereIn(TO_DB.documentType, documentTypes);  
    }

    if (operationCodes) {
      query.whereIn(TO_DB.operationCode, operationCodes);  
    }

    if (context) {
      query.where(TO_DB.context, context);
    }
    if (contexts) {
      query.whereIn(TO_DB.context, contexts);
    }

    if (counterpartBusinessSupplierId) {
      query.where(TO_DB.counterpartBusinessSupplierId, counterpartBusinessSupplierId)
    }

    if (counterpartClientId) {
      query.where(TO_DB.counterpartClientId, counterpartClientId);
    }

    if (clientId) {
      query.where(TO_DB.counterpartClientId, clientId);
    }

    if (storeDocId) {
      query.where(TO_DB.id, storeDocId);
    }

    if (counterpartWarehouseId) {
      query.where(TO_DB.counterpartWarehouseId, counterpartWarehouseId);
    }

    if (warehouseId) {
      query.where(TO_DB.warehouseId, warehouseId);
    }

    if (productIds) {
      query.whereIn(
        TO_DB.id, 
        this._db.select(this._db.raw('distinct sdp_std_id_fk'))
        .from('store_doc_products_tbl')
        .whereIn('sdp_stp_id_fk', productIds)
      );
    }

    if (productId) {
      query.whereIn(
        TO_DB.id, 
        this._db.select(this._db.raw('distinct sdp_std_id_fk'))
        .from('store_doc_products_tbl')
        .where('sdp_stp_id_fk', productId)
      );
    }

    if(orderId) {
      query.where(TO_DB.orderId, orderId);
    }
  }

  async addMissingProducts(businessId, products, trx) {
    products.forEach(product => {
      if (product.code)
        product.code = product.code.replace(/[^A-Za-z0-9\u0400-\u04FF]/gm, '').toUpperCase();
    })

    for(let i = 0; i < products.length; i++) {
      if (products[i].addToStore) {
        try {
          const result = await this.storeProductModel.create({
            ...products[i],
            productUnitId: products[i].docProductUnitId || 1,
            businessId,
          }, trx);
          products[i].productId = result.id;
        } catch (error) {
          if (error.message.includes('violates unique constraint "store_products_tbl_stp_code_stp_bsn_id_fk_stp_brt_id_fk_unique"')) {
            const product = await this.storeProductModel.get({
              brandId: products[i].brandId,
              code: products[i].code,
              businessId,
            }, trx);

            products[i].productId = product.id;
            continue;
          }
          throw error;
        }
      }
    }
    for(let i = 0; i < products.length; i++) {
      if(products[i].stockPrice && products[i].sellingPrice) {
        products[i].stockPrice = products[i].stockPrice.toString();
        products[i].sellingPrice = products[i].sellingPrice.toString();
      }
    }
    return products;
  }

  async validateUpdateFromDone(document, trx) {
    const {
      oldTransactionId,
      doneDatetime, 
      docProducts,
      id,
    } = document;
    const productIds = docProducts.map(x => x.productId);

    const docQuery = trx('store_docs_tbl')
      .count()
      .innerJoin('store_doc_products_tbl', 'sdp_std_id_fk', 'std_id_pk')
      .where('std_status', 'DONE')
      .whereNot('std_transaction_id', oldTransactionId)
      .where('std_done_datetime', '>=', doneDatetime)
      .whereIn('sdp_stp_id_fk', productIds)
      .whereNot('std_id_pk', id)
      .first();
    
    const wmsQuery = trx('wms_cell_movements_tbl')
      .count()
      .whereNot('wcm_transaction_id', oldTransactionId)
      .where('wcm_datetime', '>=', doneDatetime)
      .whereIn('wcm_stp_id_fk', productIds)
      .first();

    if(_.get(document, 'operationCode') == 'SRT') 
      return;

    const operationsMade = !!(parseInt((await docQuery).count) + parseInt((await wmsQuery).count));

    return { 
      error: operationsMade, 
      message: 'Неможливо відмінити документ, якщо вже були проведені операції з товарами.'
    };
  }

  async processUpdateFromDone(document, trx) {
    const {
      oldTransactionId,
      businessId,
      id,
    } = document;

    const returnedProducts = await trx('store_doc_products_tbl')
      .select('sdp_calc_from as calculatedFrom')
      .where('sdp_std_id_fk', document.id);

    for (let returnedProduct of returnedProducts) {
      if (!_.get(returnedProduct, 'calculatedFrom')) continue; 
      
      for (let data of returnedProduct.calculatedFrom) {
        const {
          docProductId,
          quantity,
        } = data;
        
        await trx.raw(`
          update store_doc_products_tbl
            set sdp_return_quantity = sdp_return_quantity + ${quantity}
            where sdp_id_pk = ${docProductId};
        `);
      }
    }
    
    return await trx(this.table)
      .delete()
      .where(TO_DB.transactionId, oldTransactionId)
      .where(TO_DB.businessId, businessId)
      .whereNot(TO_DB.id, id);
  }

  async sellDetailsFromOrders(options) {
    let {
      businessId,
      managerId,
      fromDatetime,
      warehouseId,
      orderIds,
      auto,
    } = options;
    const result = [];
    
    if (auto) {
      const idsQuery = this._db('orders_tbl')
        .select('ord_id_pk as id')
        .where('ord_bsn_id_fk', businessId)
        .where('ord_status', 'success')
        .whereRaw(`(ord_id_pk not in (select std_ord_id_fk from store_docs_tbl where std_bsn_id_fk = ${businessId} and std_operation_code = 'OUT'))`);

      if (fromDatetime) { 
        idsQuery.where('ord_datetime', '>=', fromDatetime);
      }

      orderIds = (await idsQuery).map(({ id }) => id);
    }

    if (!warehouseId) {
      warehouseId = (await this.warehousesModel.getWarehouses({attribute: 'MAIN', businessId}))[0].id
    }

    const transactionId = this.transactionPrefix + (await this._db.raw(`select nextval('seq_trx') as id;`)).rows[0].id;

    await this._db.transaction(async trx => {
      await trx.raw('set transaction isolation level read uncommitted;');

      for (const orderId of orderIds) {
        const { clientId, doneDatetime } = await trx('orders_tbl')
          .select('ord_cln_id_fk as clientId')
          .select('ord_success_datetime as doneDatetime')
          .where('ord_id_pk', orderId)
          .first();

        const orderDetails = await trx('orders_simple_appurtenancies_tbl')
          .select(
            'oap_stp_id_fk as productId',
            'oap_purchase_price as purchasePrice',
            'oap_count as quantity',
            'oap_price as price',
            'oap_id_pk as id',
            'oap_cell_address as cellAddress',
          )
          .whereRaw('oap_stp_id_fk is not null')
          .where('oap_ord_id_fk', orderId);

        if (!orderDetails.length) continue;

        const doc = {
          dontCreateIfEmpty: true,
          doneDatetime,
          businessId,
          managerId,
          transactionId,
          warehouseId,
          status: 'DONE',
          context: 'STOCK',
          documentType: 'CLIENT',
          type: 'EXPENSE',
          counterpartClientId: clientId,
          orderId,
          docProducts: orderDetails.map(product => {
            return {
              takeAvailable: true,
              skipIfUnavailable: true,
              productId: product.productId,
              quantity: round(parseFloat(product.quantity)),
              stockPrice: parseFloat(product.purchasePrice ? product.purchasePrice : 0),
              sellingPrice: parseFloat(product.price ? product.price : 0),
              ordersAppurtenancies: [product.id],
              getFromAddress: product.cellAddress,
            }
          })
        };

        result.push(await this.create(doc, trx));
      }
    });

    return { success: !!result.length, result, transactionId };
  }

  // requires: document.docProducts and productId in them; counterpartBusinessSupplierId; businessId; managerId
  // adds docId and expenseDocId to the document if succeed
  async createApiOrder(document, trx) {
    const {
      counterpartBusinessSupplierId,
      docProducts,
      businessId,
      managerId,
    } = document;

    const supplierData = await trx('business_suppliers_tbl')
      .select('bsp_name as name')
      .where('bsp_id_pk', counterpartBusinessSupplierId)
      .first();


    const products = [];
    for (const product of docProducts) {
      const { quantity, productId } = product;
  
      const productData = await trx('store_products_tbl')
        .select('stp_code as code')
        .select('brt_name as brand')
        .leftJoin('brands_tbl', 'brt_id_pk', 'stp_brt_id_fk')
        .where('stp_id_pk', productId)
        .first();
        
      products.push({ count: quantity, code: productData.code, brand: productData.brand });
    }

    const orderData = {
      supplier: supplierData.name,
      businessId,
      managerId,
      products,
    };

    const result = await this.externalApiModel.sendOrder(orderData);

    document.externalApiDocId = _.get(result, 'docId');
    if(document.externalApiDocId) {
      document.externalApiOrderStatus = 'SENT';
      document.supplierDocNumber = _.get(result, 'docNumber');
    }
  }

  // creates order expenses / stock incomes
  async receiveApiOrder(options) {
    const {
      externalApiDocId,
      businessId,
      managerId,
    } = options;

    return await this._db.transaction(async trx => {
      await trx.raw('set transaction isolation level read uncommitted;');

      const carbookDoc = await this.get({ externalApiDocId, businessId, externalApiOrderStatus: 'SENT', status: 'DONE' }, trx);

      if (!carbookDoc) throw Boom.badRequest('Not found')

      const supplierData = await trx('business_suppliers_tbl')
        .select('bsp_name as name')
        .where('bsp_id_pk', carbookDoc.counterpartBusinessSupplierId)
        .first();

      const externalApiExpenseDoc = await this.externalApiModel.getExpenseDoc({
        supplier: supplierData.name,
        externalApiDocId,
        businessId,
        managerId,
      });
      
      const externalApiExpenseDocId = externalApiExpenseDoc.externalApiExpenseDocId;
      const supplierDocNumber = externalApiExpenseDoc.num;
      
      const incomeDoc = {
        status: 'DONE',
        documentType: 'SUPPLIER',
        type: 'EXPENSE',
        context: 'ORDER',
        counterpartBusinessSupplierId: carbookDoc.counterpartBusinessSupplierId,
        externalApiOrderStatus: 'RECEIVED',
        supplierDocNumber,
        externalApiExpenseDocId,
        businessId,
        managerId,
        docProducts: externalApiExpenseDoc.products.map(prd => ({
          productId: parseInt(prd.carbookProductId),
          stockPrice: parseFloat(prd.price),
          quantity: parseFloat(prd.count),
        })),
      }
      
      await this.update({ externalApiOrderStatus: 'RECEIVED', externalApiExpenseDocId }, { businessId, id: carbookDoc.id }, trx)
      return await this.create(incomeDoc, trx);
    });
  }

  // returns the available min document done datetime
  async getAvailableMinDatetime({ businessId, id }, trx) {
    const db = trx ? trx : this._db;
    
    const query = db('store_docs_tbl')
      .select(db.raw(`std_done_datetime as datetime`))
      .where('std_bsn_id_fk', businessId)
      .whereRaw('std_done_datetime is not null')
      .orderByRaw('std_done_datetime desc')
      .first();

    if (id) {
      
      query.whereNot('std_id_pk', id);
    }

    return { datetime: _.get(await query, 'datetime', null) };
  }

  // when the document is created with DONE status or updated from NEW status
  async doneHandler({ id, businessId }, trx) {
    const db = trx ? trx : this._db;

    const document = await this.get({id, businessId}, trx);
    const {
      managerId,

      documentType,
      context,
      status,
      type,
    } = document;
    
    if (documentType === DOCUMENT_TYPES.SUPPLIER && context === CONTEXTS.ORDER && status === STATUSES.DONE && type === TYPES.EXPENSE) {
      await (_.get(document, 'docProducts')).forEach(async product => {
        const {
          ordersAppurtenancies,
        } = product;

        if (_.get(ordersAppurtenancies, 'length')) {
          for (let i = 0; i < ordersAppurtenancies.length; i++) {
            await db.raw(`
              update orders_simple_appurtenancies_tbl set oap_id_pk = oap_id_pk where oap_id_pk = ${ordersAppurtenancies[i]};
            `);
            
            await this.unreserveAllPossible({
              ordersAppurtenanciesIds: [ordersAppurtenancies[i]],
              businessId,
              managerId,
            }, db);
  
            await this.reserveAllPossible({
              ordersAppurtenanciesIds: [ordersAppurtenancies[i]],
              businessId,
              managerId,
            }, db);
          }
        }
      });
    }
  }

  /*
    * процесс проходит по всем н/з (кроме статусом Выполнено и Отклонено), по всем товарам в статусе "Подтверждено", 
      где Резерв < Кол-во
    * На каждой позиции делает операцию Резерв (см. п. 1) - без модалок
  */
  async reserveAllPossible(filters, _trx) {
    const {
        ordersAppurtenanciesIds,
        businessId,
        managerId,
        whsId
    } = filters;
    const docs = [];
    const result = [];

    const db = _trx ? _trx : this._db;
  
    const orders = (await db.raw(`
            select 
                oap_ord_id_fk as "orderId", 
                oap_whs_id_fk as "warehouseId",
                oap_transfered_from_repair_area as "transferfromRepairArea",
                JSON_AGG (
                JSON_BUILD_OBJECT (
                    'count', oap_count, 
                    'price', coalesce(oap_price, 0), 
                    'purchasePrice', coalesce(oap_purchase_price, 0), 
                    'productId', oap_stp_id_fk,
                    'docProductUnitId', oap_mu_id_fk, 
                    'reservedCount', get_reserve_count(oap_id_pk, oap_ord_id_fk, ord_bsn_id_fk),
                    'getFromAddress', oap_cell_address,
                    'ordersAppurtenancies', oap_id_pk 
                )
                ) AS products
            from orders_simple_appurtenancies_tbl
            left join orders_tbl on ord_id_pk = oap_ord_id_fk
            where ord_status not in ('success', 'cancel')
                and ord_bsn_id_fk = ${businessId}
                and oap_stp_id_fk is not null
                and oap_count > coalesce(
                  get_reserve_count(oap_id_pk, oap_ord_id_fk, ord_bsn_id_fk), 0
                )
                ${_.has(ordersAppurtenanciesIds, 'length') ? `and oap_id_pk in (${ordersAppurtenanciesIds.join(',')})` : `and oap_agreement = 'AGREED'`}
            group by oap_ord_id_fk, oap_whs_id_fk, oap_transfered_from_repair_area
            order by oap_ord_id_fk, oap_whs_id_fk;
        `)).rows;
   
    const reserveWhs = await this.warehousesModel.getWarehouses({attribute: 'RESERVE', businessId}, db);
    const reserveWhsId = reserveWhs.length ? reserveWhs[0].id : null;
    const mainWhs = await this.warehousesModel.getWarehouses({attribute: 'MAIN', businessId}, db);
    const mainWhsId = mainWhs.length ? mainWhs[0].id : null;

    if (reserveWhsId && mainWhsId && orders.length) {
        for (let i = 0; i < orders.length; i++) {
            for (let j = 0; j < orders[i].products.length; j++) {
                const count = orders[i].products[j].count;
                const alreadyReservedCount = orders[i].products[j].reservedCount || 0;
                const reserveCount = round(parseFloat(count)-parseFloat(alreadyReservedCount));
                if (reserveCount > 0) {
                    docs.push({
                        warehouseId: orders[i].warehouseId || whsId || mainWhsId,
                        counterpartWarehouseId: reserveWhsId, 
                        status: 'DONE',
                        documentType: 'TRANSFER',
                        type: 'EXPENSE',
                        context: 'STOCK',
                        orderId: orders[i].orderId,
                        transferfromRepairArea: orders[i].transferfromRepairArea,
                        docProducts: [{
                            takeAvailable: true,
                            productId: orders[i].products[j].productId,
                            docProductUnitId: orders[i].products[j].docProductUnitId,
                            quantity: reserveCount,
                            stockPrice: parseFloat(orders[i].products[j].purchasePrice),
                            sellingPrice: parseFloat(orders[i].products[j].price),
                            ordersAppurtenancies: [orders[i].products[j].ordersAppurtenancies],
                            getFromAddress: orders[i].products[j].getFromAddress,
                            addToAddress: orders[i].products[j].getFromAddress ? 'RESERVE' : null,
                        }]
                      });
                }
            }
        }
    }

    for (let i = 0; i < docs.length; i++) {
        try {
            await db.transaction(async trx => {
                const validate = Joi.validate(docs[i], createScheme);
                if (validate.error) {
                    throw Boom.badRequest(validate.error.details[0].message);
                }

                const transfer = await this.create({ ...docs[i], businessId, managerId }, trx);

                if (transfer.id) {
                  for (let j = 0; j < transfer.docProducts.length; j++) {
                    if (Math.abs(parseFloat(transfer.docProducts[j].quantity)) > 0) {
                      await trx('orders_simple_appurtenancies_tbl')
                        .update({
                          oap_whs_id_fk: docs[i].warehouseId || mainWhsId,
                          oap_transfered_from_repair_area: false, // Коли запчастина була повернута із цеху, і якщо потрібно ще раз її встановити то під час резервації змінюється статус із Скасовано на Готово
                        })
                        .where('oap_ord_id_fk', docs[i].orderId)
                        .whereIn('oap_id_pk', transfer.docProducts[j].ordersAppurtenancies);
                    }
                  }
                }

                result.push({ ...docs[i], ...transfer });
            });
        } catch(err) {
            result.push({error: true, err});
            console.error(err);
        }
    }

    return this.buildResult(result, ordersAppurtenanciesIds);
  }

  async triggerOrderDetailUpdate(db, options) {
    const { filterBy } = options;

    if (!filterBy || filterBy === 'DETAIL_IDS') {
      const { detailIds } = options;

      await db('orders_simple_appurtenancies_tbl')
        .update({
          oap_id_pk: db.raw('oap_id_pk')
        })
        .whereIn('oap_id_pk', detailIds);
    } else if (filterBy === 'BUSINESS') {
      const { businessId, productIds } = options;

      const query = db('orders_simple_appurtenancies_tbl')
        .update({
          oap_id_pk: db.raw('oap_id_pk')
        })
        .whereRaw(`(select ord_bsn_id_fk from orders_tbl where ord_id_pk = oap_ord_id_fk limit 1) = ${businessId}`);

        if (productIds)
          query.whereIn('oap_stp_id_fk', productIds);
  
        await query;
    } else {
      throw `Invalid filterBy value: ${filterBy}`;
    }
  }

  async unreserveAllPossible(filters, _trx) {
    const {
        ordersAppurtenanciesIds,
        reserveTransferTrx,
        businessId,
        managerId,
    } = filters;

    const docs = [];
    const result = [];

    const db = _trx ? _trx : this._db;

    const orders = (await db.raw(`
            select 
                oap_ord_id_fk as "orderId",
                last_reserve_whs.whs_id_pk "reservedFromWarehouseId",
                JSON_AGG (
                JSON_BUILD_OBJECT (
                    'sellingPrice', coalesce(oap_price, 0), 
                    'stockPrice', coalesce(oap_purchase_price, 0), 
                    'productId', oap_stp_id_fk,
                    'docProductUnitId', oap_mu_id_fk,  
                    'quantity', get_reserve_count(oap_id_pk, oap_ord_id_fk, ord_bsn_id_fk),
                    'addToAddress', oap_cell_address,
                    'ordersAppurtenancies', oap_id_pk 
                )
                ) AS products
            from orders_simple_appurtenancies_tbl
            left join orders_tbl on ord_id_pk = oap_ord_id_fk
            left join get_last_reserve_warehouse(oap_id_pk, ord_bsn_id_fk) as last_reserve_whs
              on last_reserve_whs.oap_id = oap_id_pk
            where ord_bsn_id_fk = ${businessId}
                and oap_stp_id_fk is not null
                and coalesce(
                  get_reserve_count(oap_id_pk, oap_ord_id_fk, ord_bsn_id_fk), 0
                ) > 0
                ${_.has(ordersAppurtenanciesIds, 'length') ? `and oap_id_pk in (${ordersAppurtenanciesIds.join(',')})` : ''}
            group by oap_ord_id_fk, last_reserve_whs.whs_id_pk
            order by oap_ord_id_fk;
        `)).rows;

    const reserveWhs = await this.warehousesModel.getWarehouses({attribute: 'RESERVE', businessId}, db);
    const reserveWhsId = reserveWhs.length ? reserveWhs[0].id : null;


    for (let i = 0; i < orders.length; i++) {
        docs.push({
            warehouseId: reserveWhsId,
            counterpartWarehouseId: orders[i].reservedFromWarehouseId, 
            status: 'DONE',
            documentType: 'TRANSFER',
            type: 'EXPENSE',
            context: 'STOCK',
            orderId: orders[i].orderId,
            docProducts: orders[i].products.map(x => ({
                ...x,
                getFromAddress: x.addToAddress ? 'RESERVE' : null,
                ordersAppurtenancies: [x.ordersAppurtenancies],
            })),
        });
    }

    for (let i = 0; i < docs.length; i++) {
        try {
            await db.transaction(async trx => {
                const validate = Joi.validate(docs[i], createScheme);
                if (validate.error) {
                    throw Boom.badRequest(validate.error.details[0].message);
                }
        
                const transfer = await this.create({ ...docs[i], businessId, managerId }, trx);
                result.push({ ...docs[i], ...transfer });
            });
        } catch(err) {
            result.push({error: true, err});
            console.error(err);
        }

    }

    await this.triggerOrderDetailUpdate(db, { detailIds: ordersAppurtenanciesIds });
   
    return this.buildResult(result, ordersAppurtenanciesIds);
  }

  async transferProductsForCell(credentials ,filters) {
    const {
      businessId,
      managerId,
    } = credentials;
    const {
        productId,
        fromWarehouseId,
        fromCell,
        toCell,
        count,
        toWarehouseId, 
    } = filters;
    const docs = [];
    const result = [];

    const db = this._db;

    const query = db('store_docs_tbl')
      .sum('sdp_quantity')
      .leftJoin('store_doc_products_tbl', 'sdp_std_id_fk', 'std_id_pk')
      .where('std_status', 'DONE')
      .first();

    if (fromWarehouseId) {
      query
        .leftJoin('warehouses_tbl', 'whs_id_pk', 'std_whs_id_fk')
        .where('std_whs_id_fk', fromWarehouseId)
        .where('whs_consider_quantity', true)
        .where('std_environment', 'STOCK')
        .where('whs_direct_sales', true);
    }

    if (productId) {
      query.where('sdp_stp_id_fk', productId);
    }
    if (fromCell) {
      query.whereRaw(`(sdp_add_address_ref = '${fromCell}' or sdp_get_address_ref = '${fromCell}')`);
    } else {
      query.whereRaw(`(sdp_add_address_ref is null and sdp_get_address_ref is null)`);
    }

    const orders = await query;
    const trCount = orders.sum - count;

    if (orders) {
          if (trCount >= 0) {
            docs.push({
                warehouseId: fromWarehouseId,
                counterpartWarehouseId: toWarehouseId, 
                status: 'DONE',
                documentType: 'TRANSFER',
                type: 'EXPENSE',
                context: 'STOCK',
                docProducts: [{
                takeAvailable: true,
                productId: productId,
                quantity: count,
                stockPrice: 100, //parseFloat(orders.purchasePrice),
                sellingPrice: 200, //parseFloat(orders.price),
                ordersAppurtenancies: [],
                getFromAddress: fromCell,
                addToAddress: toCell,
                }]
              });
          }
    }
    if(docs.length){
      for (let i = 0; i < docs.length; i++) {
        try {
            await db.transaction(async trx => {
                if (process.env.DISABLE_ISOLATION_SETTING != 'yes')
                  await trx.raw('set transaction isolation level read uncommitted;');
                const validate = Joi.validate(docs[i], createScheme);
                if (validate.error) {
                    throw Boom.badRequest(validate.error.details[0].message);
                }

                const transfer = await this.create({ ...docs[i], businessId, managerId }, trx);

                // result.push({ ...docs[i], ...transfer });
            });
            result.push({success: true});
        } catch(err) {
            result.push({error: true, err});
            console.error(err);
        }
      }
    } else {
      result.push({error: true, err: `Product ${productId} count in warehouse: ${Math.round(orders.sum, 2)} - less than your count: ${Math.round(count, 2)}`})
    }
    
    return result;
  }

  async buildResult(result, ids) {
    const foundIdsObj = {};
    result.forEach(doc => {
        if (_.get(doc, 'docProducts.length')) {
            doc.docProducts.forEach(dp => {
                if (_.get(dp, 'ordersAppurtenancies.length')) {
                    dp.ordersAppurtenancies.forEach(id => {
                        foundIdsObj[id] = 0;
                    })
                }
            });
        }
    });

    const foundIds = Object.keys(foundIdsObj);
    return { 
        created: result.filter(({ error }) => !error).length > 0, 
        all: foundIds.length === ids.length, 
        success: foundIds.length > 0, 
        createdDocs: result };
  }

  async getDocIds(options) {
    const { businessId } = options;

    const query = this._db(this.table)
      .select('std_id_pk as id')
      .where(TO_DB.businessId, businessId)

    
    this.applyFilters(query, options);

    return (await query).map(elem => elem.id);
  }

  async getSupplierOrderCounts(options, trx) {
    const db = trx ? trx : this._db;

    options.status = STATUSES.DONE;
    options.context = CONTEXTS.ORDER;

    const query = db
      .select({ businessSupplierId: TO_DB.counterpartBusinessSupplierId })
      .select(db.raw('sum(sdp_quantity) as quantity'))
      .from(this.table)
      .leftJoin('store_doc_products_tbl', DOC_PRODUCT_TO_DB.docId, TO_DB.id)
      .where('sdp_stp_id_fk', options.productId)
      .groupBy(TO_DB.counterpartBusinessSupplierId)
      .having(db.raw('sum(sdp_quantity) > 0'));

    this.applyFilters(query, options);
    return query;
  }

  // One time function to fix one of the customer's mistake (recalculates prices)
  async pavelRetard9301() {
    const db = this._db;

    const test = await db('store_docs_tbl')
      .select(
        'warehouse.whs_name as store_docwarehouseName',
        'warehouse.whs_attribute as store_docwrhAttribute',
        'bsp_name as store_doccounterpartBusinessSupplierName',
        'counterpart_whs.whs_name as store_doccounterpartWarehouseName',
        'counterpart_whs.whs_attribute as store_doccounterpartWhsAttribute',
      )
      .select({
        ...TO_DB_WITH_PREFIX,
        ...DOC_PRODUCT_TO_DB_WITH_PREFIX,
        ...PRODUCT_TO_DB_WITH_PREFIX,
      })
      .select(this._db.raw('std_sum + 0 as store_docsum'))
      .leftJoin('store_doc_products_tbl', 'sdp_std_id_fk', 'std_id_pk')
      .leftJoin('store_products_tbl', 'stp_id_pk', 'sdp_stp_id_fk')
      .leftJoin('managers_tbl', 'mng_id_pk', 'std_mng_id_fk')
      .leftJoin('brands_tbl', 'brt_id_pk', 'stp_brt_id_fk')

      .leftJoin(this._db.raw('warehouses_tbl as warehouse on std_whs_id_fk = warehouse.whs_id_pk'))
      .leftJoin('business_suppliers_tbl', 'std_counterpart_bsp_id_fk', 'bsp_id_pk')
      .leftJoin('clients_tbl', 'std_counterpart_cln_id_fk', 'cln_id_pk')
      .leftJoin(this._db.raw('warehouses_tbl as counterpart_whs on std_counterpart_whs_id_fk = counterpart_whs.whs_id_pk'))
      .leftJoin('employees_tbl', 'std_counterpart_eml_id_fk', 'eml_id_pk')
      .leftJoin(this._db.raw(`barcodes_tbl on bct_ref_id::int = std_id_pk and bct_table = 'STORE_DOCS'`))
      .leftJoin('requisites_tbl', 'std_rqt_id_fk', 'rqt_id_pk')
      .leftJoin('business_suppliers_requisites_tbl', 'std_bsr_id_fk', 'bsr_id_pk')
      .leftJoin('clients_requisites_tbl', 'std_crq_id_fk', 'crq_id_pk')
      .where('std_id_pk', 400769)
      .where('std_bsn_id_fk', 9301);

  let product = joinjs.mapOne(
    test,
    MAPS,
    'storeDocMap',
    JOIN_PREFIX,
    false
  );

  let i = 0;
  const arr = [];

  if(product.docProducts){
    for(let el of product.docProducts){
      const query = db('store_doc_products_tbl')
      .select(
        'sdp_stp_id_fk as productId',
        db.raw('sdp_quantity::numeric::float as quantity'),
        db.raw('sdp_stock_price::numeric::float as "purchasePrice"'),
        'sdp_std_id_fk as storeDocId',
        'sdp_id_pk as docProductId',
      )
      .leftJoin('store_docs_tbl', 'sdp_std_id_fk', 'std_id_pk')
      .leftJoin('business_suppliers_tbl', 'std_counterpart_bsp_id_fk', 'bsp_id_pk')
      .where('sdp_stp_id_fk', el.product.id)
      .where('std_environment', 'STOCK')
      .where('std_status', 'DONE')
      .where('sdp_quantity', '>', 0)
      .where('std_operation_code', 'CRA')
      .where(db.raw('sdp_stock_price::numeric = sdp_selling_price::numeric'))
      .orderBy('sdp_id_pk', 'desc');

      // TODO: remove test code
      const test = await query;
      if(test.length > 0){
        arr.push(...test);
      }
      
      console.log('CRA COUNT:', i +=test.length);
      
      await this.hardRecalcFIFO({productId: el.product.id, businessId: 9301, context: 'STOCK'})
    }

    // let autarr = [];
    // for(let el of arr){
    //   console.log(el.productId)
    //   const query = db('store_doc_products_tbl')
    //   .select(
    //     'sdp_stp_id_fk as productId',
    //     db.raw('sdp_quantity::numeric::float as quantity'),
    //     db.raw('sdp_stock_price::numeric::float as "purchasePrice"'),
    //     'sdp_std_id_fk as storeDocId',
    //     'sdp_id_pk as docProductId',
    //   )
    //   .leftJoin('store_docs_tbl', 'sdp_std_id_fk', 'std_id_pk')
    //   .leftJoin('business_suppliers_tbl', 'std_counterpart_bsp_id_fk', 'bsp_id_pk')
    //   .where('sdp_stp_id_fk', el.productId)
    //   .where('std_environment', 'STOCK')
    //   .where('std_status', 'DONE')
    //   // .where('sdp_quantity', '>', 0)
    //   .where('std_operation_code', 'AUT')
    //   .orderBy('sdp_id_pk');

    //   const test = await query;
    //   console.log('KEK',test[0].purchasePrice)
    //     autarr.push(...test)
    // }

    // for(let el of autarr){
    //   await db.raw(`update 
    //   store_doc_products_tbl sdpt set sdp_stock_price = ${el.purchasePrice} 
    //   from store_docs_tbl spt
    //   where sdp_stp_id_fk = ${el.productId}
    //   and sdpt.sdp_std_id_fk = spt.std_id_pk 
    //   and spt.std_status  = 'DONE' 
    //   and spt.std_operation_code = 'CRA'
    //   and spt.std_environment = 'STOCK'`)
    // }

  }
}


  async hardRecalcFIFO(options) {
    const {
      businessId,
      productId,
    } = options;
    options.context = CONTEXTS.STOCK;

    return await this._db.transaction(async trx => {
      const usedMap = {}
      let count = 0;
  
      // Get all the expenses for this product
      const expenses = await this.storeDocProductModel.getExpenseProductsList(options, trx);
  
      // calculate average price for each expense by the income list
      for (let i = 0; i < expenses.length; i++) {
        const {
          storeDocProductId,
          warehouseId,
          productId,
          quantity,
          cell,
        } = expenses[i];
        
        const combinationKey = `${productId}__${warehouseId}__${cell}`;

        // get incomes
        const incomes = await this.storeDocProductModel.getIncomeList({ ...expenses[i], ...options }, trx);
  
        // skip a part of incomes from the start (skipping only used incomes already)
        const filteredIncomes = this.skipIncomes(incomes, _.get(usedMap, combinationKey, 0));

        // get <quantity> from income list and find the average value
        const [ value, calculatedFrom ] = this.fifo(filteredIncomes, quantity);
        
        // update stockPrice and calculatedFrom fields by storeProductId
        const updated = await trx('store_doc_products_tbl')
          .update({
            sdp_stock_price: value, 
            sdp_calc_from: JSON.stringify(calculatedFrom),
          })
          .where('sdp_id_pk', storeDocProductId)
          .whereNot('sdp_stock_price', value);
        
        // skip <quantity> from next incomes
        usedMap[combinationKey] = _.get(usedMap, combinationKey, 0) + quantity;
        count += updated;
      }
  
      return { updated: !!count, count };
    });
  }

  // this function divides the given quantity from a list of quantities
  skipIncomes(incomes, quantity) {
    for (let i = 0; i < incomes.length; i++) {
      if (incomes[i].quantity < quantity) {
        quantity -= incomes[i].quantity
        incomes[i].quantity = 0;
      } else {
        incomes[i].quantity -= quantity;
        quantity = 0;
        break;
      }
    }

    return incomes.filter(x => x.quantity); // it filters out the elements of incomes where the quantity is zero
  }

  // this function gets the given quantity out of the incomes list and finds the average of the prices
  fifo(incomes, quantity) {
    const calculatedFrom = [];
    const originalQuantity = quantity;
    let sum = 0;

    for (let i = 0; i < incomes.length; i++) {
      quantity = round(quantity);
      incomes[i].quantity = round(incomes[i].quantity);
      if (incomes[i].quantity < quantity) {
        sum += incomes[i].quantity * incomes[i].purchasePrice;
        quantity -= incomes[i].quantity;
        incomes[i].quantity = 0;

        calculatedFrom.push({
          storeDocId: incomes[i].storeDocId,
          docProductId: incomes[i].docProductId,
          quantity: incomes[i].quantity,
          stockPrice: incomes[i].purchasePrice,
        });

      } else if (incomes[i].quantity >= quantity) {
        sum += quantity * incomes[i].purchasePrice;
        incomes[i].quantity -= quantity;

        calculatedFrom.push({
          storeDocId: incomes[i].storeDocId,
          docProductId: incomes[i].docProductId,
          quantity: quantity,
          stockPrice: incomes[i].purchasePrice,
        });
        break;
      }
    }

    return [round(sum / originalQuantity), calculatedFrom]
  }

  async decorateWithProductStatus(doc, trx) {
    const db = trx ? trx : this._db;
    const {
      operationCode,
      warehouseId,
      businessId,
      context,
      status,
    } = doc;

    return await db.transaction(async trx => {
      for (let i = 0; i < doc.docProducts.length; i++) {
        let {
          getFromAddress: cell,
          sellingPrice,
          stockPrice,
          productId,
          quantity,
        } = doc.docProducts[i];

        sellingPrice = Math.abs(parseFloat(sellingPrice));
        stockPrice = Math.abs(parseFloat(stockPrice));
        quantity = Math.abs(parseFloat(quantity));
  
        const reservedQuantity = productId ? Math.abs(await this.storeDocProductModel.getReservedCount(productId, businessId, warehouseId, cell)) : 0;
        const availableQuantity = productId ? await this.storeDocProductModel.countAvailable({ 
          warehouseId,
          productId,
          context,
          cell,
        }) : 0;
  
        if (['INC', 'STP', 'CRT'].includes(operationCode)) {
          if (status === STATUSES.DONE) {
            doc.docProducts[i].status = 'OK';
          } else if (!productId && !quantity && (!stockPrice || !sellingPrice)) {
            doc.docProducts[i].status = 'ENTER_DATA';
          } else {
            doc.docProducts[i].status = 'READY';
          }
        } else if (['OUT', 'AUT', 'CST', 'STM', 'SRT', 'TSF', 'TOL', 'TOR'].includes(operationCode)) {
          if (status === STATUSES.DONE) {
            doc.docProducts[i].status = 'OK';
          } else if (!productId && !quantity && (!stockPrice || !sellingPrice)) {
            doc.docProducts[i].status = 'ENTER_DATA';
          } else if (availableQuantity >= quantity) {
            doc.docProducts[i].status = 'READY';
          } else if (reservedQuantity + availableQuantity >= quantity) {
            doc.docProducts[i].status = 'IN_RESERVE';
          } else if (reservedQuantity + availableQuantity < quantity) {
            doc.docProducts[i].status = 'NO_GOODS';
          }
        }
      }
  
      return doc;
    });
  }

  async swapProducts(options) {
    const {
      id,
      order1,
      order2,
    } = options;

    return await this._db.transaction(async trx => {
      const a = await trx('store_doc_products_tbl')
        .update({ sdp_order: -1 })
        .where('sdp_std_id_fk', id)
        .where('sdp_order', order1);
      const b = await trx('store_doc_products_tbl')
        .update({ sdp_order: order1 })
        .where('sdp_std_id_fk', id)
        .where('sdp_order', order2);
      const c = await trx('store_doc_products_tbl')
        .update({ sdp_order: order2 })
        .where('sdp_std_id_fk', id)
        .where('sdp_order', -1);
  
  
      return { success: true };
    });
  }

  async getReceiveServicesAppearance(options) {
    const db = this._db;
    const { orderId, serviceIds } = options;
    const appearance = await db('store_doc_services_tbl')
      .select({ id: 'sds_id_pk' })
      .where('sds_ord_id_fk', orderId)

    return appearance.some(Boolean);
  }
};
