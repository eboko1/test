/* eslint-disable no-underscore-dangle */
/* eslint-disable react/sort-comp */
/* eslint-disable max-classes-per-file */
import { Form } from '@ant-design/compatible';
import { ExclamationCircleOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons';
import {
    AutoComplete,
    Button,
    Checkbox,
    DatePicker,
    Input,
    InputNumber,
    Modal,
    Select,
    Tooltip,
    notification
} from 'antd';
import { Numeral } from 'commons';
import { MODALS, loadModal, resetModal, saveModal, setModal } from 'core/modals/duck';
import dayjs from 'dayjs';
import StoreDocServicesTable from 'forms/StorageForms/StorageDocumentForm/components/StoreDocServicesTable';
import _ from 'lodash';
import {
    AddClientModal,
    AddOrderFromDocumentModal,
    DetailCatalogueModal,
    SetBarcodeModal,
    StoreDocServiceModal,
    SupplierModal,
    WMSCellsModal
} from 'modals';
import React, { Component } from 'react';
import { FormattedMessage, injectIntl } from 'react-intl';
import { withRouter } from 'react-router';
import book from 'routes/book';
import { StockIcon } from 'theme';
import {
    buildStoreGroupsTree,
    fetchAPI,
    getCurrency,
    goTo,
    isForbidden,
    permissions,
    showStorageWarehouses,
    storageDocumentMapper,
    withReduxForm
} from 'utils';

import DocProductsTable from './components/DocProductsTable';

import Styles from './styles.m.css';

const { Option } = Select;
const { TextArea } = Input;
const { confirm } = Modal;
const formItemLayout = {
    labelCol: { span: 8 },
    wrapperCol: { span: 14 }
};
const requiredField = () => <b style={{ color: 'var(--required)' }}> *</b>;

const disabledSelectText = { color: 'var(--text)' };
const mask = '0,0.00';
const INCOME = 'INCOME';
const EXPENSE = 'EXPENSE';
const RESERVE = 'RESERVE';
const SUPPLIER = 'SUPPLIER';
const SERVICE = 'SERVICE';
const CLIENT = 'CLIENT';
const INVENTORY = 'INVENTORY';
const OWN_CONSUMPTION = 'OWN_CONSUMPTION';
const TRANSFER = 'TRANSFER';
const ADJUSTMENT = 'ADJUSTMENT';
const ORDERINCOME = 'ORDERINCOME';
const ORDER = 'ORDER';
const NEW = 'NEW';
const DONE = 'DONE';
const MAIN = 'MAIN';
const TOOL = 'TOOL';
const REPAIR_AREA = 'REPAIR_AREA';
const PRESERVATION = 'PRESERVATION';

const CLIENT_CTP = 'CLIENT_CTP';
const SUPPLIER_CTP = 'SUPPLIER_CTP';

@withRouter
@withReduxForm({
    name: 'storageDocumentForm',
    actions: {
        setModal,
        resetModal,
        saveModal,
        loadModal
    },
    mapStateToProps: state => ({
        modal: state.modals.modal
        // user: state.auth,
    })
})
@injectIntl
class StorageDocumentForm extends Component {
    _isMounted = false;

    constructor(props) {
        super(props);
        this.state = {
            modalVisible: false,
            editKey: undefined,
            clientSearchValue: '',
            counterpartOptionInfo: {
                value: undefined,
                children: ''
            },
            warning: false,
            productBarcode: undefined,
            products: [],
            units: []
        };
        this.hideModal = this.hideModal.bind(this);
        this.showModal = this.showModal.bind(this);
        this.editProduct = this.editProduct.bind(this);
    }

    addProductById = async productId => {
        const { cells } = this.props;
        const { type, documentType } = this.props.formData;

        const detail = await fetchAPI('GET', `store_products/${productId}`);
        if (detail) {
            const {
                id,
                brand,
                code,
                name,
                uktz,
                stockPrice,
                sellingPrice,
                quantity,
                tradeCode,
                purchasePrice,
                cellAddresses,
                orderId,
                productUnitId
            } = detail;
            let addToAddress;
            let getFromAddress;

            let preferAddress = cellAddresses
                ? cells.find(cell => cell.address == cellAddresses[0] && cell.enabled)
                : undefined;
            preferAddress = preferAddress ? preferAddress.address : undefined;

            if (type == INCOME || documentType == ORDERINCOME || type == TRANSFER) {
                addToAddress = preferAddress;
            } else if (type == EXPENSE) {
                getFromAddress = preferAddress;
            }

            await this.props.addDocProduct({
                productId: id,
                detailCode: code,
                brandName: brand.name,
                brandId: brand.id,
                tradeCode,
                detailName: name,
                uktz,
                stockPrice: Number(purchasePrice || 0),
                sellingPrice: Number(sellingPrice || 0),
                quantity: quantity || 1,
                addToAddress: addToAddress || this.state.addToAddress || detail.getFromAddress,
                getFromAddress: getFromAddress || this.state.getFromAddress || detail.getFromAddress,
                orderId,
                docProductUnitId: productUnitId
            });
        }
    };

    addProductByIdBarcode = async productId => {
        const { cells } = this.props;
        const { type, documentType } = this.props.formData;

        const detail = await fetchAPI('GET', `store_products/${productId}`);
        if (detail) {
            const {
                id,
                brand,
                code,
                name,
                uktz,
                stockPrice,
                sellingPrice,
                quantity,
                tradeCode,
                purchasePrice,
                cellAddresses,
                orderId,
                productUnitId
            } = detail;
            let addToAddress;
            let getFromAddress;
            let preferAddress = cellAddresses
                ? cells.find(cell => cell.address == cellAddresses[0] && cell.enabled)
                : undefined;
            preferAddress = preferAddress ? preferAddress.address : undefined;

            if (type == INCOME || documentType == ORDERINCOME || type == TRANSFER) {
                addToAddress = preferAddress;
            } else if (type == EXPENSE) {
                getFromAddress = preferAddress;
            }

            this.state.products.push({
                productId: id,
                detailCode: code,
                brandName: brand.name,
                brandId: brand.id,
                tradeCode,
                detailName: name,
                uktz,
                stockPrice: Number(purchasePrice || 0),
                sellingPrice: Number(sellingPrice || 0),
                quantity: quantity || 1,
                addToAddress: addToAddress || this.state.addToAddress || detail.getFromAddress,
                getFromAddress: getFromAddress || this.state.getFromAddress || detail.getFromAddress,
                orderId,
                docProductUnitId: productUnitId
            });
            await this.setState({});
        }
    };

    addByBarcode = async barcode => {
        const barcodeData = await fetchAPI('GET', 'barcodes', {
            barcode
        });
        const productBarcode = barcodeData.find(({ table }) => table === 'STORE_PRODUCTS');

        if (productBarcode) {
            if (productBarcode.existence) {
                confirm({
                    title: 'order_form_table.sure_to_add_barcode',
                    icon: <ExclamationCircleOutlined />,
                    onOk: () => {
                        this.addProductById(productBarcode.referenceId);
                    },
                    onCancel: async () => {
                        await fetchAPI(
                            'DELETE',
                            'barcodes',
                            null,
                            {
                                referenceId: productBarcode.referenceId
                            },
                            { handleErrorInternally: true }
                        );
                    }
                });
            } else {
                this.addProductById(productBarcode.referenceId);
            }
        } else {
            this.setState({
                productBarcode: barcode
            });
            notification.warning({
                message: this.props.intl.formatMessage({ id: 'order_form_table.code_not_found' })
            });
        }
    };

    editProduct(key, warning = false) {
        this.setState({
            editKey: key,
            warning,
            modalVisible: true
        });
    }

    showModal() {
        this.setState({
            modalVisible: true
        });
    }

    hideModal() {
        this.setState({
            modalVisible: false,
            warning: false,
            editKey: undefined
        });
    }

    getClientOption() {
        if (
            (this.props.formData.documentType === CLIENT ||
                (this.props.formData.documentType === PRESERVATION && this.props.formData.ctpType === CLIENT_CTP)) &&
            this.props.formData.counterpartId &&
            !this.state.counterpartOptionInfo.value
        ) {
            const client = this.props.clientList.find(client => client.clientId === this.props.formData.counterpartId);
            if (client) {
                this.setState({
                    counterpartOptionInfo: {
                        value: this.props.formData.counterpartId,
                        children: `${client.surname || ''} ${client.name} ${client.middleName || ''} ${
                            client.phones[0]
                        }`
                    }
                });
            }
        }
    }

    _redirectToCashFlow = () => {
        if (!isForbidden(this.props.user, permissions.ACCESS_ACCOUNTING)) {
            goTo(book.storageCalculations, {
                documentNumber: _.get(this.props, 'formData.documentNumber')
            });
        }
    };

    fetchUnits = async () => {
        const units = await fetchAPI('GET', 'business/measurement/units', undefined, undefined);
        this.setState({
            units
        });
    };

    componentDidUpdate() {
        this.getClientOption();

        if (this.props.formData.documentType === PRESERVATION && !this.props.formData.ctpType) {
            this.props.updateFormData({
                ctpType: CLIENT_CTP
            });
        }
    }

    componentDidMount = async () => {
        this._isMounted = true;
        const { location } = this.props;

        this.getClientOption();
        if (this._isMounted && location.productId) {
            this.addProductById(location.productId);
        }

        this.getMinDate();
        this.fetchUnits();
    };

    getMinDate = async () => {
        const { datetime: minDate } = await fetchAPI('GET', 'store_docs/min_date');
        this.setState({ minDate });
    };

    render() {
        const {
            editKey,
            modalVisible,
            clientSearchValue,
            counterpartOptionInfo,
            warning,
            productBarcode,
            minDate,
            loading,
            units
        } = this.state;
        const {
            id,
            addDocProduct,
            typeToDocumentType,
            warehouses,
            counterpartSupplier,
            employees,
            brands,
            deleteDocProduct,
            editDocProduct,
            clientList,
            user,
            mainWarehouseId,
            storageWarehouseId,
            reserveWarehouseId,
            toolWarehouseId,
            repairAreaWarehouseId,
            setModal,
            cells,
            businessRequisites,
            fetchSupplierRequisites,
            businessSupplierRequisites,
            fetchClientRequisites,
            clientRequisites,
            getCounterpartSupplier,
            fetchStorageDocument,
            updateDocument,
            visibleAddOrderFromDocumentModal,
            hideAddOrderModal,
            getClientList,
            addPartsToOrder
        } = this.props;

        const updateFormData = (data, saveMode = false) => {
            this.props.updateFormData(data, saveMode);
            this.setState({});
        };

        const {
            type,
            documentType,
            supplierDocNumber,
            counterpartId,
            docProducts,
            docServices,
            status,
            sum,
            sellingSum,
            sellingSumTax,
            payUntilDatetime,
            incomeWarehouseId,
            businessRequisiteId,
            businessSupplierRequisiteId,
            clientRequisiteId,
            expenseWarehouseId,
            remainSum,
            sumTax,
            showTax,
            warehouseId,
            comment,
            doneDatetime,
            externalApiOrderStatus,
            createApiOrder,
            externalApiDocId,
            operationCode,
            counterpartClientId,
            counterpartBusinessSupplierId,
            counterpartEmployeeId,
            ctpType,
            orderId,
            docProductUnitId,
            ordNum,
            clientName,
            clientPhone
        } = this.props.formData;

        const mapperData = storageDocumentMapper(operationCode);

        const dateFormat = 'DD.MM.YYYY';
        const disabled = status == DONE;

        const showRequisites =
            documentType == ORDER ||
            documentType == SERVICE ||
            documentType == CLIENT ||
            documentType == SUPPLIER ||
            documentType == ADJUSTMENT ||
            documentType == ORDERINCOME;

        return (
            <div>
                <Form
                    {...formItemLayout}
                    style={{
                        margin: '14px 0',
                        padding: '0 0 16px',
                        borderBottom: '1px solid var(--lightGray)'
                    }}
                >
                    <div
                        style={{
                            margin: '15px 0',
                            padding: '0 0 15px',
                            display: 'flex',
                            justifyContent: 'space-between'
                        }}
                    >
                        <div
                            style={{
                                width: '20%'
                            }}
                        >
                            <div>
                                <FormattedMessage id='storage.type' />
                                {requiredField()}
                                <Select
                                    data-qa='select_type_storage_document_form'
                                    disabled={disabled || status == NEW}
                                    onChange={value => {
                                        if (value == INCOME || value == ORDER) {
                                            updateFormData({
                                                incomeWarehouseId: mainWarehouseId,
                                                expenseWarehouseId: undefined
                                            });
                                        } else if (value == EXPENSE) {
                                            updateFormData({
                                                incomeWarehouseId: undefined,
                                                expenseWarehouseId: mainWarehouseId
                                            });
                                        } else if (value == TRANSFER) {
                                            updateFormData({
                                                incomeWarehouseId: undefined,
                                                expenseWarehouseId: mainWarehouseId
                                            });
                                        }

                                        updateFormData({
                                            type: value,
                                            documentType: typeToDocumentType[value.toLowerCase()].documentType[0],
                                            counterpartId: undefined
                                        });
                                    }}
                                    style={disabledSelectText}
                                    value={type}
                                >
                                    <Option value={INCOME}>
                                        <FormattedMessage id='storage.INCOME' />
                                    </Option>
                                    <Option value={EXPENSE}>
                                        <FormattedMessage id='storage.EXPENSE' />
                                    </Option>
                                    <Option value={TRANSFER}>
                                        <FormattedMessage id='storage.TRANSFER' />
                                    </Option>
                                    <Option value={ORDER}>
                                        <FormattedMessage id='storage.ORDER' />
                                    </Option>
                                </Select>
                            </div>
                            <div>
                                <FormattedMessage id='storage_document.document_type' />
                                {requiredField()}
                                <Select
                                    data-qa='select_document_type_storage_document_form'
                                    disabled={disabled || status == NEW}
                                    onChange={value => {
                                        if (value == TRANSFER) {
                                            updateFormData({
                                                incomeWarehouseId: undefined,
                                                expenseWarehouseId: mainWarehouseId
                                            });
                                        } else if (value == RESERVE) {
                                            updateFormData({
                                                incomeWarehouseId: reserveWarehouseId,
                                                expenseWarehouseId: mainWarehouseId
                                            });
                                        } else if (value == TOOL) {
                                            updateFormData({
                                                incomeWarehouseId: toolWarehouseId,
                                                expenseWarehouseId: repairAreaWarehouseId
                                            });
                                        } else if (value == REPAIR_AREA) {
                                            updateFormData({
                                                incomeWarehouseId: repairAreaWarehouseId,
                                                expenseWarehouseId: toolWarehouseId
                                            });
                                        } else if (value == PRESERVATION) {
                                            updateFormData({
                                                incomeWarehouseId: type === INCOME ? storageWarehouseId : undefined,
                                                expenseWarehouseId: type === EXPENSE ? storageWarehouseId : undefined
                                            });
                                        }
                                        updateFormData({
                                            documentType: value,
                                            counterpartId: undefined,
                                            ctpType: undefined
                                        });
                                    }}
                                    style={disabledSelectText}
                                    value={documentType}
                                >
                                    {type &&
                                        typeToDocumentType[type.toLowerCase()].documentType.map(documentType => {
                                            return (
                                                <Option key={documentType} value={documentType}>
                                                    <FormattedMessage
                                                        id={`storage_document.docType.${type}.${documentType}`}
                                                    />
                                                </Option>
                                            );
                                        })}
                                </Select>
                            </div>
                            {documentType === PRESERVATION && (
                                <div>
                                    <FormattedMessage id='storage_document.counterparty_type' />
                                    <Select
                                        disabled={disabled || status == NEW}
                                        onChange={value => {
                                            updateFormData({
                                                ctpType: value
                                            });
                                        }}
                                        placeholder={this.props.intl.formatMessage({
                                            id: 'storage.choose_counterparty'
                                        })}
                                        value={ctpType}
                                    >
                                        <Option value={CLIENT_CTP}>
                                            <FormattedMessage id='storage_document.client' />
                                        </Option>
                                        <Option value={SUPPLIER_CTP}>
                                            <FormattedMessage id='storage_document.supplier' />
                                        </Option>
                                    </Select>
                                </div>
                            )}
                            {(documentType === CLIENT ||
                                documentType === SUPPLIER ||
                                documentType === SERVICE ||
                                documentType === ADJUSTMENT ||
                                documentType === ORDERINCOME ||
                                documentType === TOOL ||
                                documentType === REPAIR_AREA ||
                                documentType === OWN_CONSUMPTION ||
                                documentType === PRESERVATION) && (
                                <div style={{ position: 'relative' }}>
                                    <FormattedMessage
                                        id={`storage.${
                                            documentType === ORDERINCOME ||
                                            documentType === ADJUSTMENT ||
                                            ctpType === SUPPLIER_CTP
                                                ? 'supplier'
                                                : documentType === TOOL ||
                                                  documentType === REPAIR_AREA ||
                                                  documentType === OWN_CONSUMPTION
                                                ? 'employee'
                                                : documentType === CLIENT || ctpType === CLIENT_CTP
                                                ? 'client'
                                                : 'supplier' || documentType.toLowerCase()
                                        }`}
                                    />
                                    {requiredField()}

                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between'
                                        }}
                                    >
                                        <Select
                                            data-qa='select_client_storage_document_form'
                                            disabled={disabled || status == DONE}
                                            filterOption={(input, option) => {
                                                if (
                                                    documentType == SUPPLIER ||
                                                    documentType == SERVICE ||
                                                    documentType == ADJUSTMENT ||
                                                    documentType == ORDERINCOME
                                                ) {
                                                    return true;
                                                }
                                                const searchValue = option.children
                                                    .toLowerCase()
                                                    .replace(/[+()-\s]/g, '');
                                                const inputValue = input.toLowerCase();

                                                return searchValue.indexOf(inputValue) >= 0;
                                            }}
                                            onBlur={() => {
                                                this.setState({
                                                    clientSearchValue: ''
                                                });
                                            }}
                                            onChange={(value, option) => {
                                                updateFormData({
                                                    counterpartId: value
                                                });
                                                this.setState({
                                                    counterpartOptionInfo: {
                                                        value,
                                                        children: String(option.children)
                                                    }
                                                });

                                                if (
                                                    documentType == SUPPLIER ||
                                                    documentType == SERVICE ||
                                                    documentType == ADJUSTMENT ||
                                                    documentType == ORDERINCOME ||
                                                    ctpType == SUPPLIER_CTP
                                                ) {
                                                    // fetch supplier requisites
                                                    fetchSupplierRequisites(value);
                                                    getCounterpartSupplier();
                                                }
                                                if (documentType == CLIENT || ctpType == CLIENT_CTP) {
                                                    fetchClientRequisites(value);
                                                }
                                                if (status === NEW) {
                                                    updateDocument();
                                                }
                                            }}
                                            onSearch={input => {
                                                if (
                                                    documentType == SUPPLIER ||
                                                    documentType == SERVICE ||
                                                    documentType == ADJUSTMENT ||
                                                    documentType == ORDERINCOME
                                                ) {
                                                    getCounterpartSupplier(input);

                                                    return;
                                                }
                                                this.setState({
                                                    clientSearchValue: input
                                                });
                                                if (input.length > 2) getClientList(input);
                                            }}
                                            // optionFilterProp={'children'}
                                            showSearch
                                            style={disabledSelectText}
                                            value={counterpartId}
                                        >
                                            {(documentType == SUPPLIER ||
                                                documentType == SERVICE ||
                                                documentType == ADJUSTMENT ||
                                                documentType == ORDERINCOME ||
                                                ctpType == SUPPLIER_CTP) &&
                                                counterpartSupplier.map((elem, i) => {
                                                    return (
                                                        <Option key={i} value={elem.id}>
                                                            {elem.name}
                                                        </Option>
                                                    );
                                                })}
                                            {(documentType == TOOL ||
                                                documentType == REPAIR_AREA ||
                                                documentType == OWN_CONSUMPTION) &&
                                                employees.map((employee, i) => {
                                                    return (
                                                        <Option key={i} value={employee.id}>
                                                            {`${employee.surname || ''} ${employee.name || ''} ${
                                                                employee.phone
                                                            }`}
                                                        </Option>
                                                    );
                                                })}
                                            {documentType == CLIENT || ctpType == CLIENT_CTP ? (
                                                clientSearchValue.length > 2 ? (
                                                    clientList
                                                        .filter(
                                                            (client, index, self) =>
                                                                self.findIndex(c => c.clientId === client.clientId) ===
                                                                index
                                                        )
                                                        .map((client, key) => {
                                                            return (
                                                                <Option
                                                                    key={key}
                                                                    phones={client.phones}
                                                                    value={client.clientId}
                                                                >
                                                                    {`${client.surname || ''} ${client.name} ${
                                                                        client.middleName || ''
                                                                    } ${client.phones[0]}`}
                                                                </Option>
                                                            );
                                                        })
                                                ) : clientName ? (
                                                    <Option value={counterpartId}>
                                                        {clientName} {_.get(clientPhone, '0')}
                                                    </Option>
                                                ) : null
                                            ) : null}
                                        </Select>

                                        <Button
                                            disabled={
                                                !counterpartClientId &&
                                                !counterpartBusinessSupplierId &&
                                                !counterpartEmployeeId
                                            }
                                            icon={<LinkOutlined />}
                                            onClick={() => {
                                                goTo(
                                                    counterpartClientId
                                                        ? `${book.client}/${counterpartClientId}`
                                                        : counterpartBusinessSupplierId
                                                        ? `${book.supplier}/${counterpartBusinessSupplierId}`
                                                        : `${book.employeesPage}/${counterpartEmployeeId}`
                                                );
                                            }}
                                            style={{
                                                width: '12%'
                                            }}
                                        />

                                        {(documentType == SUPPLIER ||
                                            documentType == SERVICE ||
                                            documentType == ADJUSTMENT ||
                                            documentType == ORDERINCOME) &&
                                            !(disabled || status == NEW) && (
                                                <PlusOutlined
                                                    className={Styles.addIcon}
                                                    onClick={() => this.props.setModal(MODALS.SUPPLIER)}
                                                />
                                            )}

                                        {(documentType == PRESERVATION || documentType == CLIENT) &&
                                            !(disabled || status == NEW || ctpType == SUPPLIER_CTP) && (
                                                <PlusOutlined
                                                    className={Styles.addIcon}
                                                    data-qa='add_client_storage_document_form'
                                                    onClick={() => this.props.setModal(MODALS.ADD_CLIENT)}
                                                />
                                            )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div
                            style={{
                                width: '20%'
                            }}
                        >
                            <div>
                                <FormattedMessage id='storage_document.storage_expenses' />
                                {(type == EXPENSE || type == TRANSFER) && requiredField()}
                                <Select
                                    data-qa='select_warehouse_expenses_storage_document_form'
                                    disabled={
                                        type == INCOME ||
                                        type == ORDER ||
                                        documentType == TOOL ||
                                        documentType == REPAIR_AREA ||
                                        disabled
                                    }
                                    onSelect={value => {
                                        updateFormData({
                                            expenseWarehouseId: value
                                        });
                                    }}
                                    style={disabledSelectText}
                                    value={expenseWarehouseId}
                                >
                                    {warehouses.map(elem => {
                                        return (
                                            <Option
                                                key={elem.id}
                                                disabled={
                                                    elem.attribute === 'RESERVE' ||
                                                    (elem.attribute === 'REPAIR_AREA' && type !== 'TRANSFER') ||
                                                    (operationCode &&
                                                        elem.attribute === 'STORAGE' &&
                                                        !showStorageWarehouses.includes(operationCode)) ||
                                                    (operationCode &&
                                                        showStorageWarehouses.includes(operationCode) &&
                                                        elem.attribute !== 'STORAGE') ||
                                                    (documentType === PRESERVATION && elem.attribute !== 'STORAGE')
                                                }
                                                value={elem.id}
                                            >
                                                {elem.name}
                                            </Option>
                                        );
                                    })}
                                </Select>
                            </div>
                            <div>
                                <FormattedMessage id='storage_document.storage_income' />
                                {(type == INCOME || type == TRANSFER) && requiredField()}
                                <Select
                                    data-qa='select_warehouse_income_storage_document_form'
                                    disabled={
                                        type == EXPENSE ||
                                        (type == ORDER && documentType != ORDERINCOME) ||
                                        documentType == RESERVE ||
                                        documentType == TOOL ||
                                        documentType == REPAIR_AREA ||
                                        disabled
                                    }
                                    onSelect={value => {
                                        updateFormData({
                                            incomeWarehouseId: value
                                        });
                                    }}
                                    style={disabledSelectText}
                                    value={incomeWarehouseId}
                                >
                                    {warehouses.map(elem => {
                                        return (
                                            <Option
                                                key={elem.id}
                                                disabled={
                                                    elem.attribute === 'RESERVE' ||
                                                    (elem.attribute === 'REPAIR_AREA' && type !== 'TRANSFER') ||
                                                    (operationCode &&
                                                        elem.attribute === 'STORAGE' &&
                                                        !showStorageWarehouses.includes(operationCode)) ||
                                                    (operationCode &&
                                                        showStorageWarehouses.includes(operationCode) &&
                                                        elem.attribute !== 'STORAGE') ||
                                                    (documentType === PRESERVATION && elem.attribute !== 'STORAGE')
                                                }
                                                value={elem.id}
                                            >
                                                {elem.name}
                                            </Option>
                                        );
                                    })}
                                </Select>
                            </div>
                            {(type == INCOME || type == EXPENSE || type == ORDER) && (
                                <div>
                                    <FormattedMessage id='storage.document_num' />
                                    <Input
                                        data-qa='enter_document_num_storage_document_form'
                                        disabled={isForbidden(user, permissions.ACCESS_STOCK)}
                                        onChange={event => {
                                            updateFormData({
                                                supplierDocNumber: event.target.value
                                            });
                                            this.setState({
                                                update: true
                                            });
                                        }}
                                        style={{ color: 'var(--text3)' }}
                                        value={supplierDocNumber}
                                    />
                                </div>
                            )}
                        </div>

                        <div
                            style={{
                                width: '20%'
                            }}
                        >
                            <div>
                                <FormattedMessage id='storage_document.business_requisites' />
                                <Select
                                    data-qa='select_business_requisites_storage_document_form'
                                    disabled={disabled}
                                    onSelect={value => {
                                        updateFormData({
                                            businessRequisiteId: value
                                        });
                                    }}
                                    style={disabledSelectText}
                                    value={businessRequisiteId || _.get(user, 'businessRequisitesId')}
                                >
                                    {businessRequisites
                                        .filter(({ enabled }) => enabled)
                                        .map((elem, i) => {
                                            return (
                                                <Option key={i} value={elem.id}>
                                                    {elem.name}
                                                    {elem.isTaxPayer && (
                                                        <span
                                                            style={{
                                                                marginLeft: 8,
                                                                color: 'var(--text2)'
                                                            }}
                                                        >
                                                            (<FormattedMessage id='with_VAT' />)
                                                        </span>
                                                    )}
                                                </Option>
                                            );
                                        })}
                                </Select>
                            </div>

                            {(documentType == SUPPLIER ||
                                documentType == SERVICE ||
                                documentType == ADJUSTMENT ||
                                documentType == ORDERINCOME ||
                                (documentType == PRESERVATION && ctpType == SUPPLIER_CTP)) && (
                                <div>
                                    <FormattedMessage id='storage_document.business_supplier_requisites' />
                                    <Select
                                        data-qa='select_business_supplier_requisites_storage_document_form'
                                        disabled={disabled}
                                        onSelect={value => {
                                            updateFormData({
                                                businessSupplierRequisiteId: value
                                            });
                                        }}
                                        style={disabledSelectText}
                                        value={businessSupplierRequisiteId}
                                    >
                                        {businessSupplierRequisites
                                            .filter(({ enabled }) => enabled)
                                            .map((elem, i) => {
                                                return (
                                                    <Option key={i} value={elem.id}>
                                                        {elem.name}
                                                        {elem.isTaxPayer && (
                                                            <span
                                                                style={{
                                                                    marginLeft: 8,
                                                                    color: 'var(--text2)'
                                                                }}
                                                            >
                                                                (<FormattedMessage id='with_VAT' />)
                                                            </span>
                                                        )}
                                                    </Option>
                                                );
                                            })}
                                    </Select>
                                </div>
                            )}

                            {(documentType == CLIENT || (documentType == PRESERVATION && ctpType == CLIENT_CTP)) && (
                                <div>
                                    <FormattedMessage id='storage_document.clients_requisites' />
                                    <Select
                                        data-qa='select_clients_ruquisitites_storage_document_form'
                                        disabled={disabled}
                                        onSelect={value => {
                                            updateFormData({
                                                clientRequisiteId: value
                                            });
                                        }}
                                        style={disabledSelectText}
                                        value={clientRequisiteId}
                                    >
                                        {clientRequisites.map((elem, i) => {
                                            return (
                                                <Option key={i} value={elem.id}>
                                                    {elem.name}
                                                    {elem.isTaxPayer && (
                                                        <span
                                                            style={{
                                                                marginLeft: 8,
                                                                color: 'var(--text2)'
                                                            }}
                                                        >
                                                            (<FormattedMessage id='with_VAT' />)
                                                        </span>
                                                    )}
                                                </Option>
                                            );
                                        })}
                                    </Select>
                                </div>
                            )}
                            {documentType == SUPPLIER && type == ORDER && (
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-end',
                                        height: externalApiDocId ? 53 : 48
                                    }}
                                >
                                    {externalApiDocId ? (
                                        <Button
                                            data-qa='recevce_api_order_storage_document_form'
                                            onClick={async () => {
                                                await fetchAPI(
                                                    'POST',
                                                    'store_docs/receive_external_api_order',
                                                    undefined,
                                                    { externalApiDocId },
                                                    { handleErrorInternally: true }
                                                );
                                                await notification.success({
                                                    message: this.props.intl.formatMessage({
                                                        id: 'barcode.success'
                                                    })
                                                });
                                            }}
                                            style={{ width: '100%' }}
                                        >
                                            <FormattedMessage id='storage_document.recicve_api_order' />
                                        </Button>
                                    ) : (
                                        <React.Fragment>
                                            <FormattedMessage id='storage_document.order_thought_api' />
                                            <Checkbox
                                                checked={createApiOrder || externalApiOrderStatus}
                                                data-qa='order_thought_api_storage_document_form'
                                                disabled={externalApiOrderStatus}
                                                onChange={value => {
                                                    updateFormData({
                                                        createApiOrder: true
                                                    });
                                                    this.setState({});
                                                }}
                                                style={{ padding: '0 0 0 8px' }}
                                            />
                                        </React.Fragment>
                                    )}
                                </div>
                            )}
                        </div>

                        <div
                            style={{
                                width: '30%',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between'
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between'
                                }}
                            >
                                <div
                                    style={{
                                        width: '100%',
                                        paddingRight: 8
                                    }}
                                >
                                    <div className={Styles.sumWrapper} data-qa='purchase_sum_storage_document_form'>
                                        <span
                                            style={{
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            <FormattedMessage id='storage_gocument.purch_sum_without_VAT' />
                                        </span>
                                        <Numeral
                                            className={Styles.sumNumeral}
                                            currency={getCurrency()}
                                            mask={mask}
                                            nullText='0'
                                        >
                                            {parseFloat(Number(sum).toFixed(2))}
                                        </Numeral>
                                    </div>

                                    <div className={Styles.sumWrapper} data-qa='selling_sum_storage_document_form'>
                                        <span
                                            style={{
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            <FormattedMessage id='storage_gocument.purch_sum_with_VAT' />
                                        </span>
                                        <Numeral
                                            className={Styles.sumNumeral}
                                            currency={getCurrency()}
                                            mask={mask}
                                            nullText='0'
                                        >
                                            {parseFloat(Number(sumTax).toFixed(2))}
                                        </Numeral>
                                    </div>

                                    <div className={Styles.sumWrapper} data-qa='sum_tax_storage_document_form'>
                                        <span
                                            style={{
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            <FormattedMessage id='storage_gocument.sell_sum_without_VAT' />
                                        </span>
                                        <Numeral
                                            className={Styles.sumNumeral}
                                            currency={getCurrency()}
                                            mask={mask}
                                            nullText='0'
                                        >
                                            {parseFloat(Number(sellingSum).toFixed(2))}
                                        </Numeral>
                                    </div>

                                    <div className={Styles.sumWrapper} data-qa='paid_storage_document_form'>
                                        <span
                                            style={{
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            <FormattedMessage id='storage_gocument.sell_sum_with_VAT' />
                                        </span>
                                        <Numeral
                                            className={Styles.sumNumeral}
                                            currency={getCurrency()}
                                            mask={mask}
                                            nullText='0'
                                        >
                                            {parseFloat(Number(sellingSumTax).toFixed(2))}
                                        </Numeral>
                                    </div>
                                </div>
                                <div
                                    className={Styles.sumWrapper}
                                    data-qa='remain_storage_document_form'
                                    onClick={() => this._redirectToCashFlow()}
                                    style={{
                                        background: 'var(--static)',
                                        fontSize: 16,
                                        height: 'auto',
                                        width: '65%',
                                        justifyContent: 'center',
                                        flexDirection: 'column',
                                        padding: '0 12px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div
                                        style={{
                                            whiteSpace: 'nowrap',
                                            textAlign: 'center',
                                            color: null,
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        <FormattedMessage id='remain' />
                                        <span className={Styles.remainSum} onClick={() => this._redirectToCashFlow()}>
                                            <Numeral
                                                className={Styles.totalSum}
                                                currency={getCurrency()}
                                                mask={mask}
                                                nullText='0'
                                            >
                                                {remainSum}
                                            </Numeral>
                                        </span>
                                    </div>
                                    <div
                                        data-qa='paid_storage_document_form'
                                        style={{
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        <FormattedMessage id='paid' />
                                        <span className={Styles.remainSum} onClick={() => this._redirectToCashFlow()}>
                                            <Numeral
                                                className={Styles.totalSum}
                                                currency={getCurrency()}
                                                mask={mask}
                                                nullText='0'
                                            >
                                                {parseFloat(Number(sellingSumTax - remainSum).toFixed(2))}
                                            </Numeral>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {(type === INCOME || type === EXPENSE || type === ORDER) && (
                                <div data-qa='date_pay_until_storage_document_form' style={{ marginTop: 16 }}>
                                    <FormattedMessage id='storage_document.pay_until' />
                                    <DatePicker
                                        defaultValue={payUntilDatetime}
                                        disabled={disabled}
                                        format={dateFormat}
                                        onChange={(date, stringDate) => {
                                            updateFormData({
                                                payUntilDatetime: date
                                            });
                                        }}
                                        style={{
                                            width: '100%'
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    <div
                        style={{
                            padding: '0 10px 15px 10px',
                            display: 'flex',
                            justifyContent: 'space-between'
                        }}
                    >
                        <div
                            data-qa='comment_storage_document_form'
                            style={{
                                width: '67.5%'
                            }}
                        >
                            <FormattedMessage id='comment' />
                            <Input.TextArea
                                onChange={({ target }) => {
                                    updateFormData({
                                        comment: target.value
                                    });
                                    this.setState({
                                        update: true
                                    });
                                }}
                                type='textarea'
                                value={comment}
                            />
                        </div>
                        <div data-qa='choose_date_storage_document_form' style={{ width: '30%' }}>
                            <FormattedMessage id='date' />
                            <DatePicker
                                defaultValue={doneDatetime || dayjs()}
                                disabled={isForbidden(user, permissions.ACCESS_STOCK)}
                                disabledDate={date => {
                                    if (status == NEW) return false;
                                    if (date > dayjs() || date < dayjs(minDate)) {
                                        return true;
                                    }
                                }}
                                format={dateFormat}
                                onChange={(date, stringDate) => {
                                    updateFormData({
                                        doneDatetime: date
                                    });
                                }}
                                style={{
                                    width: '100%'
                                }}
                            />
                        </div>
                    </div>
                </Form>
                <div
                    style={{
                        margin: '24px 0 0'
                    }}
                >
                    {documentType === SERVICE &&
                    (type === INCOME || type === EXPENSE) &&
                    _.get(this.props, 'formData.id') ? ( // if service and has storeDocId should be show
                        <StoreDocServicesTable
                            disabled={disabled || !status}
                            docServices={docServices}
                            handleStoreDocServices={this.props.handleStoreDocServices}
                            // getStorageDocument={this.props.getStorageDocument}
                            mapperData={mapperData}
                            storeDocId={this.props.formData.id}
                        />
                    ) : _.get(this.props, 'formData.id') ? ( // show if storeDocId
                        <DocProductsTable
                            addByBarcode={code => this.addByBarcode(code)}
                            addPartsToOrder={addPartsToOrder}
                            barcodeFinish={() => {
                                this.props.addDocProduct(this.state.products, true);
                                this.setState({
                                    products: []
                                });
                            }}
                            businessSupplierId={counterpartId}
                            deleteDocProduct={deleteDocProduct}
                            disabled={disabled || !status}
                            docProducts={docProducts}
                            docProductUnitId={docProductUnitId}
                            documentType={documentType}
                            editProduct={this.editProduct}
                            fetchStorageDocument={fetchStorageDocument}
                            id={id}
                            loading={loading}
                            mapperData={mapperData}
                            operationCode={operationCode}
                            orderId={orderId}
                            ordNum={ordNum}
                            showModal={this.showModal}
                            type={type}
                            updateFormData={updateFormData}
                            user={user}
                        />
                    ) : null}

                    {!disabled ? <StoreDocServiceModal mapperData={mapperData} units={units} /> : null}

                    {!disabled ? (
                        <AddProductModal
                            addDocProduct={addDocProduct}
                            brands={brands}
                            businessSupplierId={type === ORDER || type === INCOME ? counterpartId : null}
                            cells={cells}
                            documentType={documentType}
                            editDocProduct={editDocProduct}
                            editKey={editKey}
                            hideModal={this.hideModal}
                            incomeWarehouseId={incomeWarehouseId}
                            mapperData={mapperData}
                            maxOrdered={type === ORDER && documentType === ADJUSTMENT}
                            operationCode={operationCode}
                            priceDisabled={
                                type === TRANSFER || documentType === OWN_CONSUMPTION || documentType === INVENTORY
                            }
                            product={editKey !== undefined ? docProducts[editKey] : undefined}
                            saveModal={saveModal}
                            setModal={setModal}
                            type={type}
                            units={units}
                            user={user}
                            visible={modalVisible}
                            warehouseId={warehouseId}
                            warehouses={warehouses}
                            warning={warning}
                        />
                    ) : null}
                </div>
                <SetBarcodeModal
                    barcode={productBarcode}
                    confirmAction={productId => this.addProductById(productId)}
                    hideModal={() => {
                        this.setState({
                            productBarcode: undefined
                        });
                    }}
                    visible={Boolean(productBarcode)}
                />
                <SupplierModal
                    func={counterpartId => {
                        this.props.updateCounterpartData(counterpartId);
                    }}
                />

                <AddClientModal
                    func={clientId => {
                        this.props.updateCounterpartClientData(clientId);
                    }}
                    resetModal={this.props.resetModal}
                    visible={this.props.modal}
                />
                <AddOrderFromDocumentModal
                    clientList={clientList}
                    clientName={clientName}
                    clientPhone={clientPhone}
                    counterpartId={counterpartId}
                    counterpartOptionInfo={counterpartOptionInfo}
                    docProducts={docProducts}
                    hideModal={hideAddOrderModal}
                    id={id}
                    products={this.state.products}
                    updateDocument={updateDocument}
                    visible={visibleAddOrderFromDocumentModal}
                />
            </div>
        );
    }
}

export default StorageDocumentForm;

@injectIntl
class AddProductModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            loading: false,
            editMode: false,
            alertModalVisible: false,
            storeGroupsTree: [],
            storageProducts: [],
            brandSearchValue: '',
            visible: false,
            showCellModal: false,
            showFromCellModal: false,
            brandId: undefined,
            brandName: undefined,
            detailCode: undefined,
            groupId: undefined,
            tradeCode: undefined,
            detailName: undefined,
            uktz: undefined,
            addToAddress: undefined,
            getFromAddress: undefined,
            sellingPrice: 0,
            stockPrice: 0,
            quantity: 1,
            docProductUnitId: 1,
            orderId: undefined,
            storageBalance: [
                { messageId: 'storage.in_stock', count: 0 },
                { messageId: 'storage.reserve', count: 0 },
                { messageId: 'storage.in_orders', count: 0 },
                { messageId: 'storage.ordered', count: 0 },
                { messageId: 'storage.deficit', count: 0 },
                { messageId: 'storage.min', count: 0 },
                { messageId: 'storage.max', count: 0 },
                { messageId: 'storage.to_order', count: 0 }
            ]
        };

        this.debouncedQuerySearch = _.debounce(value => {
            this.getStorageProductsByQuery(value);
        }, 1000);

        this.confirmAlertModal = this.confirmAlertModal.bind(this);
        this.cancelAlertModal = this.cancelAlertModal.bind(this);
    }

    getStoreGroups = async () => {
        const storeGroups = await fetchAPI('GET', 'store_groups', null, null, {
            handleErrorInternally: true
        });
        buildStoreGroupsTree(storeGroups);
    };

    getStorageProductsByQuery = async query => {
        const { list: storageProducts } = await fetchAPI(
            'GET',
            'store_products',
            { query, pageSize: 25, withoutPhoto: true },
            null,
            {
                handleErrorInternally: true
            }
        );
        this.setState({ storageProducts });
    };

    getProductId = async (detailCode, brandId, productId) => {
        const { cells, type, documentType } = this.props;
        const { storageBalance, detailName, quantity } = this.state;
        let storageProduct = null;
        if (productId) {
            storageProduct = await fetchAPI('GET', `store_products/${productId}`, null, null, {
                handleErrorInternally: true
            });
        } else {
            const { list } = await fetchAPI(
                'GET',
                'store_products/',
                {
                    filterCode: detailCode,
                    brandId,
                    pageSize: 15
                },
                null,
                {
                    handleErrorInternally: true
                }
            );
            storageProduct = list.find(({ code, brandId: brand }) => code === detailCode && brand === brandId);
        }

        if (storageProduct) {
            let addToAddress = null;
            let getFromAddress = null;
            const preferAddress = _.get(storageProduct, 'cellAddresses[0]');

            if (type === INCOME || documentType === ORDERINCOME) {
                addToAddress = preferAddress;
            } else if (type === EXPENSE || type === TRANSFER) {
                getFromAddress = preferAddress;
            }
            storageBalance[0].count = storageProduct.countInWarehouses;
            storageBalance[1].count = storageProduct.reservedCount;
            storageBalance[2].count = storageProduct.countInOrders;
            storageBalance[3].count = storageProduct.countInStoreOrders;
            storageBalance[4].count = storageProduct.lack;
            storageBalance[5].count = storageProduct.min;
            storageBalance[6].count = storageProduct.max;
            storageBalance[7].count = storageProduct.quantity;

            this.setState({
                detailCode: storageProduct.code,
                groupId: storageProduct.groupId,
                productId: storageProduct.id,
                detailName: storageProduct.name,
                uktz: storageProduct.uktz,
                brandId: storageProduct.brandId,
                brandName: storageProduct.brand && storageProduct.brand.name,
                tradeCode: storageProduct.tradeCode,
                quantity: storageProduct.quantity || 1,
                stockPrice: storageProduct.stockPrice || storageProduct.purchasePrice,
                sellingPrice: storageProduct.sellingPrice,
                // stockPrice: (this.props.sellingPrice ?
                //     storageProduct.stockPrice * (storageProduct.group && storageProduct.group.multiplier || 1.4) :
                //     storageProduct.stockPrice) || 0,
                addToAddress: addToAddress || storageProduct.getFromAddress,
                getFromAddress: getFromAddress || storageProduct.getFromAddress,
                orderId: storageProduct.orderId,
                docProductUnitId: storageProduct.productUnitId,
                unit: storageProduct.unit
            });

            return true;
        }

        storageBalance[0].count = 0;
        storageBalance[1].count = 0;
        storageBalance[2].count = 0;
        storageBalance[3].count = 0;
        storageBalance[4].count = 0;
        storageBalance[5].count = 0;
        storageBalance[6].count = 0;
        storageBalance[7].count = 0;
        this.setState({
            groupId: undefined,
            productId: undefined,
            detailName: this.props.warning ? detailName : undefined,
            quantity: quantity || 1
        });

        return false;
    };

    confirmAlertModal() {
        const { setModal } = this.props;
        const {
            detailCode,
            name,
            brandId,
            brandName,
            sellingPrice,
            stockPrice,
            quantity,
            getFromAddress,
            addToAddress,
            orderId,
            uktz,
            productUnitId,
            docProductUnitId,
            storeGroupId
        } = this.state;

        setModal(MODALS.STORE_PRODUCT, {
            brandId,
            brandName,
            groupId: storeGroupId || 1000000,
            code: detailCode,
            productUnitId: docProductUnitId,
            name,
            onSubmit: async id => {
                const detail = await fetchAPI('GET', `store_products/${id}`);
                const {
                    brand,
                    code,
                    name,
                    // uktz,
                    // getFromAddress,
                    // addToAddress,
                    // sellingPrice,
                    // quantity,
                    tradeCode
                    // orderId,
                    // productUnitId
                    // purchasePrice,
                } = detail;
                await this.props.addDocProduct({
                    productId: id,
                    detailCode: code,
                    brandName: brand.name,
                    brandId: brand.id,
                    tradeCode,
                    detailName: name,
                    getFromAddress,
                    addToAddress,
                    uktz,
                    stockPrice: Number(stockPrice || 0),
                    sellingPrice: Number(sellingPrice || 0),
                    quantity: quantity || 1, // should be sellingPrice count or stockPrice count depends on documentType,
                    orderId,
                    docProductUnitId
                });
                this.handleCancel();
            }
        });
        this.setState({
            alertModalVisible: false
        });
    }

    cancelAlertModal() {
        this.setState({
            alertModalVisible: false
        });
    }

    handleOk = async () => {
        const {
            intl: { formatMessage },
            product
        } = this.props;
        const {
            editMode,
            brandId,
            brandName,
            detailCode,
            tradeCode,
            groupId,
            detailName,
            uktz,
            stockPrice,
            quantity,
            productId,
            sellingPrice,
            addToAddress,
            getFromAddress,
            comment,
            orderId,
            docProductUnitId
        } = this.state;

        if (!brandId || !detailCode) {
            notification.error({
                message: formatMessage({ id: 'storage_document.error.required_fields' })
            });

            return;
        }

        this.setState({ loading: true });
        const isProduct = productId ? true : await this.getProductId(detailCode, brandId, productId);

        if (!isProduct) {
            const { listParts } = await fetchAPI(
                'GET',
                'products/search/v2/m3',
                {
                    code: detailCode,
                    brandId: brandId === 8000 ? undefined : brandId,
                    page: 1,
                    pageSize: 1
                },
                null,
                { handleErrorInternally: true }
            );
            if (listParts && listParts.length) {
                this.setState({
                    detailName: listParts[0].name,
                    name: listParts[0].name,
                    storeGroupId: listParts[0].storeGroupId
                });
            }
            this.setState({
                alertModalVisible: true,
                loading: false
            });
        } else if (editMode) {
            await this.props.editDocProduct(this.props.product.key, {
                productId,
                detailCode,
                brandName,
                brandId,
                tradeCode,
                detailName,
                uktz,
                stockPrice,
                sellingPrice,
                quantity,
                groupId,
                sum: quantity * stockPrice,
                sellingSum: quantity * sellingPrice,
                addToAddress,
                getFromAddress,
                ordersAppurtenancies: product.ordersAppurtenancies,
                comment,
                orderId,
                docProductUnitId
            });
            this.handleCancel();
        } else {
            await this.props.addDocProduct({
                productId,
                detailCode,
                brandName,
                brandId,
                tradeCode,
                detailName,
                uktz,
                stockPrice,
                quantity,
                groupId,
                sellingPrice,
                sum: quantity * stockPrice,
                sellingSum: quantity * sellingPrice,
                addToAddress,
                getFromAddress,
                comment,
                orderId,
                docProductUnitId
            });
            this.handleCancel();
        }
    };

    handleCancel() {
        this.setState({
            brandSearchValue: '',
            visible: false,
            brandId: undefined,
            brandName: undefined,
            detailCode: undefined,
            groupId: undefined,
            productId: undefined,
            tradeCode: undefined,
            detailName: undefined,
            uktz: undefined,
            addToAddress: undefined,
            getFromAddress: undefined,
            showCellModal: false,
            showFromCellModal: false,
            sellingPrice: 0,
            stockPrice: 0,
            quantity: 1,
            editMode: false,
            comment: undefined,
            orderId: undefined,
            docProductUnitId: undefined,
            name: undefined,
            loading: false,
            storeGroupId: undefined
        });
        this.props.hideModal();
    }

    componentDidUpdate(prevProps, prevState) {
        const { product, operationCode } = this.props;
        if (!prevProps.visible && this.props.visible) {
            if (product) {
                this.setState({
                    editMode: true,
                    brandId: product.brandId,
                    brandName: product.brandName,
                    detailCode: product.detailCode,
                    tradeCode: product.tradeCode,
                    groupId: product.groupId,
                    detailName: product.detailName,
                    uktz: product.uktz,
                    stockPrice: product.stockPrice,
                    quantity: product.quantity,
                    productId: product.productId,
                    ordersAppurtenancies: product.ordersAppurtenancies,
                    sellingPrice: product.sellingPrice,
                    addToAddress: product.addToAddress,
                    getFromAddress: product.getFromAddress,
                    comment: product.comment,
                    orderId: product.orderId
                });
            }
        }
        if (prevState.productId !== this.state.productId && operationCode === 'SRT' && !product) {
            this.setState({
                sellingPrice: this.state.stockPrice
            });
        }
    }

    componentDidMount() {
        this.getStoreGroups();
    }

    selectProduct = async product => {
        const { cells, type, documentType } = this.props;
        const { storageBalance } = this.state;
        if (product) {
            const {
                name,
                price,
                productCode,
                code,
                purchasePrice,
                supplierId,
                productId,
                supplierBrandId,
                docProductUnitId,
                brandId,
                store,
                oeCode,
                cellAddress,
                storeGroupId,
                warehouseId,
                supplierOriginalCode,
                supplierPartNumber
            } = product;
            let addToAddress;
            let getFromAddress;
            let preferAddress = product.cellAddresses
                ? cells.find(cell => cell.address === product.cellAddresses[0] && cell.enabled)
                : undefined;
            preferAddress = preferAddress ? preferAddress.address : undefined;

            if (type === INCOME || documentType === ORDERINCOME || type === TRANSFER) {
                addToAddress = preferAddress;
            } else if (type === EXPENSE) {
                getFromAddress = product.cellAddress || preferAddress;
            }

            storageBalance[0].count = product.countInWarehouses;
            storageBalance[1].count = product.reservedCount;
            storageBalance[2].count = product.countInOrders;
            storageBalance[3].count = product.countInStoreOrders;
            storageBalance[4].count = product.lack;
            storageBalance[5].count = product.min;
            storageBalance[6].count = product.max;
            storageBalance[7].count = product.quantity;
            await this.setState({
                productId: product.id || product.productId,
                brandId: product.brandId || product.supplierBrandId,
                brandName: product.brand && product.brand.name,
                detailCode: product.productCode,
                detailName: product.name,
                name: product.name,
                storeGroupId: product.storeGroupId,
                uktz: product.uktz,
                tradeCode: product.tradeCode,
                stockPrice: Math.round(product.purchasePrice * 10) / 10 || 0,
                sellingPrice: Math.round(product.price * 10) / 10 || 0,
                quantity: product.quantity || 1,
                addToAddress: addToAddress || product.addToAddress,
                getFromAddress: getFromAddress || product.getFromAddress,
                docProductUnitId: product.productUnitId,
                unit: product.unit
            });
        }
    };

    render() {
        const { mapperData } = this.props;
        const {
            storageProducts,
            alertModalVisible,
            brandId,
            brandName,
            detailCode,
            tradeCode,
            detailName,
            uktz,
            stockPrice,
            quantity,
            storageBalance,
            sellingPrice,
            addToAddress,
            getFromAddress,
            comment,
            showCellModal,
            showFromCellModal,
            visible,
            orderId,
            loading,
            docProductUnitId
        } = this.state;

        return (
            <Modal
                destroyOnClose
                maskClosable={false}
                okButtonProp={{ loading }}
                onCancel={() => {
                    this.handleCancel();
                }}
                onOk={() => {
                    this.handleOk();
                }}
                visible={this.props.visible}
                width='fit-content'
                zIndex={200}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        margin: '24px 0 0 0'
                    }}
                >
                    <div className={Styles.addProductItemWrap}>
                        <FormattedMessage id='order_form_table.detail_code' />
                        {requiredField()}
                        <AutoComplete
                            dropdownStyle={{
                                maxHeight: 400,
                                overflow: 'auto',
                                zIndex: '9999',
                                minWidth: 220
                            }}
                            // onBlur={() => {
                            //     this.getProductId(detailCode, brandId);
                            // }}
                            onChange={value => {
                                this.setState({
                                    detailCode: value,
                                    tradeCode: undefined
                                });

                                if (value.length >= 3) {
                                    this.debouncedQuerySearch(value);
                                }
                            }}
                            onSelect={value => {
                                // await this.setState({
                                //     detailCode: option.code,
                                //     detailName: option.detail_name,
                                //     stockPrice: option.stock_price || option.purchase_price,
                                //     sellingPrice: option.selling_price
                                // });
                                this.getProductId(undefined, undefined, value);
                            }}
                            style={{
                                minWidth: 160
                            }}
                            value={detailCode}
                        >
                            {storageProducts.map(elem => {
                                return (
                                    <Option key={elem.id} value={elem.id}>
                                        {elem.code}
                                    </Option>
                                );
                            })}
                        </AutoComplete>
                    </div>
                    {/* <StockProductsModal
                        brandFilter={brandName}
                        brandId={brandId}
                        codeFilter={detailCode}
                        selectProduct={this.selectProduct}
                        stockMode
                        user={this.props.user}
                    /> */}
                    <Button
                        icon={<StockIcon />}
                        onClick={() => {
                            this.setState({
                                visible: true
                            });
                        }}
                    />
                    <DetailCatalogueModal
                        brandId={brandId}
                        brands={this.props.brands}
                        code={detailCode}
                        hideModal={() => {
                            this.setState({
                                visible: undefined
                            });
                        }}
                        onSelect={this.selectProduct}
                        // suppliers={suppliers}
                        // treeData={treeData}
                        user={this.props.user}
                        visible={Boolean(visible)}
                    />
                    <div className={Styles.addProductItemWrap} style={{ minWidth: 140 }}>
                        <FormattedMessage id='order_form_table.brand' />
                        {requiredField()}
                        <Select
                            dropdownStyle={{
                                maxHeight: 400,
                                overflow: 'auto',
                                zIndex: '9999',
                                minWidth: 220
                            }}
                            filterOption={(input, option) => {
                                return (
                                    option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0 ||
                                    String(option.value).indexOf(input.toLowerCase()) >= 0
                                );
                            }}
                            onBlur={() => {
                                this.setState({
                                    brandSearchValue: ''
                                });
                            }}
                            onSearch={input => {
                                this.setState({
                                    brandSearchValue: input
                                });
                            }}
                            onSelect={(value, option) => {
                                this.setState({
                                    brandId: value,
                                    tradeCode: undefined,
                                    brandName: option.children
                                });
                            }}
                            showSearch
                            value={brandId}
                        >
                            {this.props.brands.map((elem, index) => (
                                <Option key={index} supplier_id={elem.supplierId} value={elem.brandId}>
                                    {elem.brandName}
                                </Option>
                            ))}
                        </Select>
                    </div>
                    <div className={Styles.addProductItemWrap} style={{ minWidth: 140 }}>
                        <FormattedMessage id='directories.orders' />
                        <Tooltip title={<FormattedMessage id='store_doc_service.source_tooltip' />}>
                            <Input
                                className={Styles.inputStoreDocService}
                                onClick={() => {
                                    this.props.saveModal();
                                    this.props.setModal(MODALS.SELECT_ORDER, {
                                        onSubmit: value => {
                                            this.setState({
                                                orderId: value
                                            });
                                        },
                                        onClose: () => {
                                            this.props.loadModal(MODALS.STORE_DOC_SERVICE);
                                        }
                                    });
                                }}
                                value={orderId}
                            />
                        </Tooltip>
                    </div>
                    <div className={Styles.addProductItemWrap}>
                        <FormattedMessage id='storage.trade_code' />
                        <Input
                            onChange={event => {
                                this.setState({
                                    uktz: event.target.value
                                });
                            }}
                            style={{
                                color: 'black'
                            }}
                            value={uktz}
                        />
                    </div>
                    <div className={Styles.addProductItemWrap}>
                        <FormattedMessage id='order_form_table.detail_name' />
                        <Input
                            disabled
                            onChange={event => {
                                this.setState({
                                    detailName: event.target.value
                                });
                            }}
                            style={{
                                color: 'black'
                            }}
                            value={detailName}
                        />
                    </div>
                    {this.props.type == INCOME && !this.props.priceDisabled && (
                        <div className={Styles.addProductItemWrap}>
                            <FormattedMessage id='order_form_table.detail_code' /> (
                            <FormattedMessage id='storage.supplier' />)
                            <Input
                                disabled
                                style={{
                                    color: 'black'
                                }}
                            />
                        </div>
                    )}
                    {this.props.type == EXPENSE || this.props.type == TRANSFER ? (
                        <div className={Styles.addProductItemWrap} style={{ minWidth: 120 }}>
                            <FormattedMessage id='wms.from_cell' />
                            <Input
                                onClick={() => {
                                    this.setState({ showFromCellModal: true });
                                }}
                                value={getFromAddress}
                            />
                            <WMSCellsModal
                                confirmAction={getFromAddress => {
                                    this.setState({
                                        getFromAddress
                                    });
                                }}
                                fixedWarehouse
                                hideModal={() => {
                                    this.setState({ showFromCellModal: false });
                                }}
                                visible={Boolean(showFromCellModal)}
                                warehouseId={this.props.warehouseId}
                            />
                        </div>
                    ) : null}
                    {this.props.type == INCOME ||
                    this.props.documentType == ORDERINCOME ||
                    this.props.type == TRANSFER ? (
                        <div className={Styles.addProductItemWrap} style={{ minWidth: 120 }}>
                            <FormattedMessage id='wms.cell' />
                            <Input
                                onClick={() => {
                                    this.setState({ showCellModal: true });
                                }}
                                value={addToAddress}
                            />
                            <WMSCellsModal
                                confirmAction={addToAddress => {
                                    this.setState({
                                        addToAddress
                                    });
                                }}
                                fixedWarehouse
                                hideModal={() => {
                                    this.setState({ showCellModal: false });
                                }}
                                visible={Boolean(showCellModal)}
                                warehouseId={this.props.incomeWarehouseId}
                            />
                        </div>
                    ) : null}

                    <div className={Styles.addProductItemWrap}>
                        <div>
                            <FormattedMessage id='order_form_table.count' />
                        </div>
                        <InputNumber
                            decimalSeparator=','
                            max={this.props.maxOrdered ? storageBalance[3].count : undefined}
                            min={0.01}
                            onChange={value => {
                                this.setState({
                                    quantity: value
                                });
                            }}
                            precision={2}
                            step={0.01}
                            style={
                                {
                                    // marginLeft: 10,
                                }
                            }
                            value={quantity}
                        />
                    </div>
                    <div className={Styles.addProductItemWrap}>
                        <div>
                            <FormattedMessage id='services_table.units' />
                        </div>
                        <Select
                            allowClear
                            dropdownMatchSelectWidth={100}
                            getPopupContainer={trigger => trigger.parentNode}
                            onSelect={value => {
                                this.setState({
                                    docProductUnitId: value
                                });
                            }}
                            placeholder={this.props.intl.formatMessage({
                                id: 'services_table.units_placeholder'
                            })}
                            showSearch
                            style={{ width: 100, color: 'var(--text)' }}
                            value={docProductUnitId}
                        >
                            {this.props.units.map((elem, index) => (
                                <Option key={elem.id} value={elem.id}>
                                    {elem.shortcut}
                                </Option>
                            ))}
                        </Select>
                    </div>
                    <React.Fragment>
                        <div className={Styles.addProductItemWrap}>
                            <div>
                                <FormattedMessage id='order_form_table.purchasePrice' />
                            </div>
                            <InputNumber
                                decimalSeparator=','
                                disabled={mapperData.purchasePriceDisabled || this.props.maxOrdered}
                                min={0}
                                onChange={stockPrice => this.setState({ stockPrice })}
                                precision={2}
                                value={stockPrice}
                            />
                        </div>
                        <div className={Styles.addProductItemWrap}>
                            <div>
                                <FormattedMessage id='storage_document.sell_price' />
                            </div>
                            <InputNumber
                                decimalSeparator=','
                                disabled={this.props.maxOrdered || mapperData.sellingPriceDisabled}
                                min={0}
                                onChange={value => {
                                    this.setState({
                                        sellingPrice: value
                                    });
                                }}
                                precision={2}
                                value={
                                    mapperData.sellingPriceEqualsPurchasePrice
                                        ? stockPrice
                                        : mapperData.sellingPriceDisabled
                                        ? 0
                                        : sellingPrice
                                }
                            />
                        </div>
                    </React.Fragment>
                </div>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: 8
                    }}
                >
                    <div>
                        {mapperData.allowProductComment && (
                            <div
                                style={{
                                    maxWidth: 250,
                                    marginRight: 5
                                    // marginLeft: 100
                                }}
                            >
                                <div>
                                    <FormattedMessage id='comment' />
                                </div>
                                <TextArea
                                    allowClear
                                    onChange={e => this.setState({ comment: e.target.value })}
                                    placeholder={this.props.intl.formatMessage({ id: 'comment' })}
                                    value={comment}
                                />
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex' }}>
                        {this.props.type == ORDER && (
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'flex-start'
                                    // marginRight: 48
                                }}
                            >
                                {storageBalance.map((elem, key) => {
                                    const message =
                                        this.props.intl.formatMessage({ id: elem.messageId }) || elem.messageId;

                                    return (
                                        <div
                                            key={key}
                                            className={Styles.addProductItemWrap}
                                            style={{ padding: '0 5px' }}
                                        >
                                            <div>{message}</div>
                                            <InputNumber
                                                decimalSeparator=','
                                                disabled
                                                style={{
                                                    color: 'black'
                                                }}
                                                value={elem.count}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {!this.props.priceDisabled && (
                            <React.Fragment>
                                <div
                                    style={{
                                        maxWidth: '180px',
                                        marginRight: 5
                                        // marginLeft: 100
                                    }}
                                >
                                    <div>
                                        <FormattedMessage id='purchase_sum' />
                                    </div>
                                    <InputNumber
                                        decimalSeparator=','
                                        disabled
                                        precision={2}
                                        style={{
                                            color: 'black'
                                            // marginLeft: 10,
                                        }}
                                        value={Math.round(quantity * stockPrice * 100) / 100}
                                    />
                                </div>
                                <div className={Styles.addProductItemWrap}>
                                    <div>
                                        <FormattedMessage id='storage_gocument.sell_sum' />
                                    </div>
                                    <InputNumber
                                        decimalSeparator=','
                                        disabled
                                        precision={2}
                                        style={{
                                            color: 'black'
                                            // marginLeft: 10,
                                        }}
                                        value={
                                            Math.round(
                                                quantity *
                                                    (mapperData.sellingPriceEqualsPurchasePrice
                                                        ? stockPrice
                                                        : mapperData.sellingPriceDisabled
                                                        ? 0
                                                        : sellingPrice) *
                                                    100
                                            ) / 100
                                        }
                                    />
                                </div>
                            </React.Fragment>
                        )}
                    </div>
                </div>

                <AddStoreProductModal
                    alertVisible={alertModalVisible}
                    cancelAlertModal={this.cancelAlertModal}
                    confirmAlertModal={this.confirmAlertModal}
                    {...this.state}
                >
                    <FormattedMessage id='storage_document.error.product_not_found' />
                </AddStoreProductModal>
            </Modal>
        );
    }
}

const measureUnitsOptions = Object.freeze({
    PIECE: 'PIECE',
    LITER: 'LITER'
});

@injectIntl
export class AddStoreProductModal extends React.Component {
    render() {
        const { alertVisible, cancelAlertModal, confirmAlertModal } = this.props;

        return (
            <React.Fragment>
                <Modal
                    maskClosable={false}
                    onCancel={cancelAlertModal}
                    onOk={confirmAlertModal}
                    visible={alertVisible}
                    zIndex={300}
                >
                    {this.props.children}
                </Modal>
            </React.Fragment>
        );
    }
}
