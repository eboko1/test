/* eslint-disable react/prefer-stateless-function */
/* eslint-disable default-case */
/* eslint-disable react/sort-comp */
/* eslint-disable max-classes-per-file */
import {
    CloseOutlined,
    CopyOutlined,
    DeleteOutlined,
    DollarOutlined,
    FileAddOutlined,
    FileSearchOutlined,
    ImportOutlined,
    LinkOutlined,
    MailOutlined,
    PrinterOutlined,
    RollbackOutlined,
    SaveOutlined,
    SwapOutlined,
    UnorderedListOutlined
} from '@ant-design/icons';
import {
    AutoComplete,
    Badge,
    Button,
    Dropdown,
    Input,
    InputNumber,
    Menu,
    Modal,
    Popconfirm,
    Select,
    Table,
    Tooltip,
    notification
} from 'antd';
import { Layout, Spinner } from 'commons';
import { Barcode } from 'components';
import { MODALS, resetModal, setModal } from 'core/modals/duck';
import dayjs from 'dayjs';
import { saveAs } from 'file-saver';
import { StorageDocumentForm } from 'forms';
import _ from 'lodash';
import {
    ImportReceiptDocumentModal,
    RefactoredCashOrderModal,
    ReferenceBookAddModal,
    StockProductsModal,
    ToSuccessModal
} from 'modals';
import { COUNTERPARTY_TYPES } from 'modals/RefactoredCashOrderModal/constants';
import * as constants from 'pages/Storage/constants';
import React, { Component } from 'react';
import { FormattedMessage, injectIntl } from 'react-intl';
import { connect } from 'react-redux';
import book from 'routes/book';
import { fetchAPI, goTo, isForbidden, permissions, showStorageWarehouses, storageDocumentMapper } from 'utils';
import { AutomaticOrderCreationModal, CopyStorageDocModal, ProductsToAddModal } from './components/modals';

const { Option } = Select;
const { error, confirm } = Modal;
const dateFormat = 'DD.MM.YYYY';

const mapStateToProps = state => {
    return {
        user: state.auth,
        modal: state.modals.modal,
        modalProps: state.modals.modalProps
    };
};

const mapDispatchToProps = {
    setModal,
    resetModal
};

const headerIconStyle = {
    fontSize: 24,
    cursor: 'pointer',
    margin: '0 0 0 18px'
};

@injectIntl
@connect(mapStateToProps, mapDispatchToProps)
class StorageDocumentPage extends Component {
    _isMounted = false;

    constructor(props) {
        super(props);
        this.state = {
            warehouses: [],
            brands: [],
            counterpartSupplier: [],
            employees: [],
            clientList: [],
            formData: {
                type: constants.INCOME,
                documentType: constants.SUPPLIER,
                sum: 0,
                docProducts: [],
                docServices: [],
                payUntilDatetime: undefined,
                counterpartId: undefined,
                businessSupplierRequisiteId: undefined,
                clientRequisiteId: undefined,
                businessRequisiteId: undefined,
                ctpType: undefined,
                insertMode: false,
                clientName: undefined,
                clientPhone: []
            },
            fetched: false,
            warnings: 0,
            loading: false,
            mainWarehouseId: undefined,
            reserveWarehouseId: undefined,
            toolWarehouseId: undefined,
            repairAreaWarehouseId: undefined,
            cells: [],
            businessRequisites: [],
            businessSupplierRequisites: [],
            clientRequisites: []
        };
    }

    addPartsToOrder = async (productIds, addAvailable) => {
        const { available } = await fetchAPI(
            'POST',
            'store_products_into_order',
            null,
            { productIds, addAvailable },
            { handleErrorInternally: true }
        );
        if (available && available.length) {
            const { docProducts } = this.state.formData;

            this.setState({
                productsToAdd: docProducts.filter(({ id }) => available.includes(id))
            });

            return;
        }

        notification.success({
            message: this.props.intl.formatMessage({
                id: 'barcode.success'
            })
        });
    };

    updateFormData = (formData, saveMode = false, callback) => {
        Object.entries(formData).map(field => {
            this.state.formData[field[0]] = field[1];
        });
        if (saveMode) {
            this.updateDocument(saveMode, callback);
        } else {
            this.setState({
                update: true
            });
        }
    };

    addDocProduct = (docProduct, arrayMode = false) => {
        if (arrayMode) {
            const newProducts = [];
            const warningProducts = [];
            docProduct.map(product => {
                product.sum = Math.round(product.sum * 10) / 10;
                this.state.formData.sum += product.sum;
                if (!product.brandId && product.brandName) {
                    const brand = this.state.brands.find(elem => elem.brandName == product.brandName);
                    product.brandId = brand ? brand.brandId : undefined;
                }
                if (product.quantity) {
                    if (!product.productId) {
                        warningProducts.push(product);
                    } else {
                        newProducts.push(product);
                    }
                }
            });
            this.state.formData.docProducts = this.state.formData.docProducts.concat(newProducts);
            if (warningProducts.length) {
                this.state.formData.docProducts = warningProducts.concat(this.state.formData.docProducts);
                this.setState({
                    forceUpdate: true
                });
            } else {
                this.updateDocument();
            }
        } else {
            docProduct.sum = Math.round(docProduct.sum * 10) / 10;
            this.state.formData.docProducts.push({
                key: this.state.formData.docProducts.length,
                ...docProduct
            });
            this.state.formData.sum += docProduct.sum;
            this.setState({
                update: true
            });
            this.updateDocument();
        }
    };

    deleteDocProduct = row => {
        const { id } = row;
        const { formData } = this.state;
        formData.sum -= formData.docProducts.find(elem => elem.id === id).sum;

        this.state.formData.docProducts = this.state.formData.docProducts.filter(elem => elem.id != id);
        this.updateDocument();
    };

    editDocProduct = (key, docProduct) => {
        const { formData } = this.state;

        formData.docProducts[key] = {
            key,
            updated: true,
            ...docProduct
        };

        formData.sum = 0;
        formData.docProducts.map(elem => {
            formData.sum += elem.quantity * elem.stockPrice;
        });
        this.updateDocument();
    };

    // saveFormRef = formRef => {
    //    this.formRef = formRef;
    // };

    verifyFields = () => {
        const {
            intl: { formatMessage }
        } = this.props;
        const { formData } = this.state;
        const showError = () => {
            notification.error({
                message: formatMessage({ id: 'storage_document.error.required_fields' })
            });
        };

        if (!formData.type) {
            showError();

            return false;
        }

        if (
            formData.documentType == constants.CLIENT ||
            formData.documentType == constants.SUPPLIER ||
            formData.documentType == constants.SERVICE ||
            formData.documentType == constants.ADJUSTMENT ||
            formData.documentType == constants.ORDERINCOME ||
            formData.documentType == constants.TOOL ||
            formData.documentType == constants.REPAIR_AREA ||
            formData.documentType == constants.OWN_CONSUMPTION ||
            formData.documentType == constants.PRESERVATION
        ) {
            if (!formData.counterpartId) {
                showError();

                return false;
            }
        }

        switch (formData.type) {
            case constants.INCOME:
            case constants.EXPENSE:
                if (!formData.incomeWarehouseId && !formData.expenseWarehouseId) {
                    showError();

                    return false;
                }
                break;
            case constants.TRANSFER:
            case constants.RESERVE:
                if (!formData.incomeWarehouseId || !formData.expenseWarehouseId) {
                    showError();

                    return false;
                }
                break;
            case constants.ORDER:
                if (!formData.counterpartId) {
                    showError();

                    return false;
                }
                break;
        }

        return true;
    };

    createDocument = () => {
        if (!this.verifyFields()) {
            return;
        }

        const { formData } = this.state;

        const createData = {
            status: constants.NEW,
            type: formData.type,
            documentType: formData.documentType,
            payUntilDatetime: formData.payUntilDatetime ? formData.payUntilDatetime.toISOString() : null,
            doneDatetime: formData.doneDatetime ? formData.doneDatetime.toISOString() : dayjs().toISOString(),
            comment: formData.comment || null,
            docProducts: []
        };

        if (formData.supplierDocNumber) {
            createData.supplierDocNumber = formData.supplierDocNumber;
        }

        if (formData.businessRequisiteId) {
            createData.businessRequisiteId = formData.businessRequisiteId;
        }
        if (formData.businessSupplierRequisiteId) {
            createData.businessSupplierRequisiteId = formData.businessSupplierRequisiteId;
        }
        if (formData.clientRequisiteId) {
            createData.clientRequisiteId = formData.clientRequisiteId;
        }

        switch (formData.type) {
            case constants.INCOME:
            case constants.EXPENSE:
                createData.warehouseId = formData.incomeWarehouseId || formData.expenseWarehouseId;
                if (formData.documentType === constants.SUPPLIER) {
                    createData.counterpartBusinessSupplierId = formData.counterpartId;
                } else if (formData.documentType === constants.SERVICE) {
                    createData.counterpartBusinessSupplierId = formData.counterpartId;
                } else if (formData.documentType === constants.CLIENT) {
                    createData.counterpartClientId = formData.counterpartId;
                } else if (formData.documentType === constants.OWN_CONSUMPTION) {
                    createData.counterpartEmployeeId = formData.counterpartId;
                } else if (formData.documentType === constants.PRESERVATION) {
                    if (formData.ctpType === constants.CLIENT_CTP) {
                        createData.counterpartClientId = formData.counterpartId;
                    } else {
                        createData.counterpartBusinessSupplierId = formData.counterpartId;
                    }
                }
                break;
            case constants.TRANSFER:
                createData.type = constants.EXPENSE;
                createData.documentType = constants.TRANSFER;
                createData.warehouseId = formData.expenseWarehouseId;
                createData.counterpartWarehouseId = formData.incomeWarehouseId;
                if (formData.documentType == constants.TOOL || formData.documentType == constants.REPAIR_AREA) {
                    createData.counterpartEmployeeId = formData.counterpartId;
                }

                delete createData.supplierDocNumber;
                delete createData.payUntilDatetime;
                break;
            case constants.ORDER:
                if (formData.documentType == constants.SUPPLIER) {
                    createData.type = constants.INCOME;
                    createData.createApiOrder = Boolean(formData.createApiOrder);
                    delete createData.warehouseId;
                } else if (formData.documentType == constants.ADJUSTMENT) {
                    createData.type = constants.EXPENSE;
                    delete createData.warehouseId;
                } else if (formData.documentType == constants.ORDERINCOME) {
                    createData.type = constants.EXPENSE;
                    createData.documentType = constants.SUPPLIER;
                    createData.warehouseId = formData.incomeWarehouseId;
                }
                createData.warehouseId = formData.incomeWarehouseId;
                createData.counterpartBusinessSupplierId = formData.counterpartId;
                createData.context = constants.ORDER;
                break;
            default:
                break;
        }

        const that = this;
        const token = localStorage.getItem('_my.carbook.pro_token');
        const url = `${__API_URL__}/store_docs`;
        fetch(url, {
            method: 'POST',
            headers: {
                Authorization: token
            },
            body: JSON.stringify(createData)
        })
            .then(function (response) {
                if (response.status !== 200) {
                    return Promise.reject(new Error(response.statusText));
                }

                return Promise.resolve(response);
            })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                that.props.history.replace(`${book.storageDocument}/${data.id}`);
                window.location.reload();
            })
            .catch(function (error) {
                console.log('error', error);
                notification.error({
                    message: 'Ошибка склада'
                });
            });
    };

    updateDocument = (saveMode = false, callback) => {
        if (this.state.loading) {
            return;
        }
        this.setState({ loading: true });
        if (!this.verifyFields()) {
            return;
        }

        const { formData, requestData } = this.state;
        const {
            intl: { formatMessage }
        } = this.props;

        const newProducts = formData.docProducts.filter(({ id }) => !id);
        let insertMode;

        newProducts.forEach(({ updated }) => {
            insertMode = insertMode || !updated;
        });
        const createData = {
            ..._.pick(requestData, [
                'documentType',
                'type',
                'context',
                'warehouseId',
                'counterpartWarehouseId',
                'counterpartEmployeeId',
                'counterpartBusinessSupplierId',
                'counterpartClientId',
                'supplierDocNumber',
                'payUntilDatetime'
            ]),
            status: formData.status,
            supplierDocNumber: formData.supplierDocNumber || null,
            payUntilDatetime: formData.payUntilDatetime ? formData.payUntilDatetime.toISOString() : null,
            comment: formData.comment,
            doneDatetime: formData.doneDatetime ? formData.doneDatetime.toISOString() : null,
            docProducts: [],
            externalApiOrderStatus: formData.externalApiOrderStatus || null,
            businessRequisiteId: formData.businessRequisiteId || null,
            businessSupplierRequisiteId: formData.businessSupplierRequisiteId || null,
            clientRequisiteId: formData.clientRequisiteId || null,
            insertMode: Boolean(insertMode),
            isAddToOrder: Boolean(formData.isAddToOrder)
        };

        switch (formData.type) {
            case constants.INCOME:
            case constants.EXPENSE:
                createData.warehouseId = formData.incomeWarehouseId || formData.expenseWarehouseId;
                if (formData.documentType == constants.SUPPLIER) {
                    createData.counterpartBusinessSupplierId = formData.counterpartId;
                } else if (formData.documentType == constants.CLIENT) {
                    createData.counterpartClientId = formData.counterpartId;
                } else if (formData.documentType == constants.PRESERVATION) {
                    if (formData.ctpType === constants.CLIENT_CTP) {
                        createData.counterpartClientId = formData.counterpartId;
                    } else {
                        createData.counterpartBusinessSupplierId = formData.counterpartId;
                    }
                }
                break;
            case constants.TRANSFER:
                createData.warehouseId = formData.expenseWarehouseId;
                createData.counterpartWarehouseId = formData.incomeWarehouseId;
                break;
            case constants.ORDER:
                createData.counterpartBusinessSupplierId = formData.counterpartId;
                if (formData.documentType == constants.SUPPLIER) {
                    createData.createApiOrder = Boolean(formData.createApiOrder);
                } else if (formData.documentType == constants.ORDERINCOME) {
                    createData.warehouseId = formData.incomeWarehouseId;
                }
                break;
            default:
                break;
        }

        let productsError = false;
        const { sellingPriceEqualsPurchasePrice, sellingPriceDisabled } = storageDocumentMapper(formData.operationCode);

        (insertMode ? newProducts : formData.docProducts).forEach(elem => {
            if (elem.productId) {
                createData.docProducts.push({
                    productId: elem.productId,
                    quantity: elem.quantity ? Math.abs(Number(elem.quantity)) : 1,
                    stockPrice: elem.stockPrice || 0,
                    sellingPrice: sellingPriceEqualsPurchasePrice
                        ? elem.stockPrice || 0
                        : sellingPriceDisabled
                        ? 0
                        : elem.sellingPrice || 0,
                    addToAddress: elem.addToAddress || null,
                    getFromAddress: elem.getFromAddress || null,
                    ordersAppurtenancies: elem.ordersAppurtenancies || [],
                    uktz: elem.uktz,
                    comment: elem.comment,
                    orderId: elem.orderId || undefined,
                    docProductUnitId: elem.docProductUnitId || 1
                });
                if (elem.tradeCode) {
                    createData.docProducts[createData.docProducts.length - 1].supplierPartNumber = elem.tradeCode;
                }
                if (elem.storeDocProductId) {
                    createData.docProducts[createData.docProducts.length - 1].storeDocProductId =
                        elem.storeDocProductId;
                }
            } else if (!saveMode) {
                /* notification.warning({
                    message: this.props.intl.formatMessage({id: 'error'}),
                }); */
                productsError = true;
            } else if (elem.code && elem.brandId) {
                createData.docProducts.push({
                    addToStore: true,
                    groupId: elem.groupId,
                    code: elem.detailCode,
                    name: elem.detailName || elem.detailCode,
                    brandId: elem.brandId,
                    // tradeCode: elem.tradeCode,

                    quantity: elem.quantity || 1,
                    stockPrice: elem.stockPrice,
                    uktz: elem.uktz,
                    orderId: elem.orderId || undefined,
                    docProductUnitId: elem.docProductUnitId || 1
                });
                if (elem.storeDocProductId) {
                    createData.docProducts[createData.docProducts.length - 1].storeDocProductId =
                        elem.storeDocProductId;
                }
            }
        });
        if (productsError) {
            this.setState({ loading: false });

            return;
        }

        if (formData.status === constants.DONE) {
            delete createData.docProduct;
        }

        const that = this;
        const token = localStorage.getItem('_my.carbook.pro_token');
        const url = `${__API_URL__}/store_docs/${this.props.id}`;
        fetch(url, {
            method: 'PUT',
            headers: {
                Authorization: token
            },
            body: JSON.stringify(createData)
        })
            .then(function (response) {
                if (response.status !== 200) {
                    return Promise.reject(new Error(response.statusText));
                }

                return Promise.resolve(response);
            })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                if (data.updated) {
                    that.getStorageDocument();
                    notification.success({
                        message: that.props.intl.formatMessage({ id: 'barcode.success' })
                    });
                    if (callback) {
                        callback();
                    }
                } else {
                    const availableInfo = [];
                    data.notAvailableProducts.map(({ available, reservedCount, productId: { product } }) => {
                        availableInfo.push(
                            <span
                                style={{
                                    display: 'flex',
                                    margin: '8 0 0 0',
                                    justifyContent: 'space-between',
                                    fontSize: 14
                                }}
                            >
                                <span style={{ fontWeight: 500 }}>
                                    {product.name} ({product.code})
                                </span>
                                <span style={{ padding: '0 0 0 12' }}>
                                    {formatMessage({ id: 'storage.available' })} {available} /{' '}
                                    {available - reservedCount} {formatMessage({ id: 'pc' })}
                                </span>
                            </span>
                        );
                    });
                    error({
                        title: formatMessage({ id: 'storage_document.error.available' }),
                        content: availableInfo.map((txt, key) => txt),
                        cancelButtonProps: { style: { display: 'none' } },
                        width: 'fit-content',
                        style: {
                            minWidth: 600
                        },
                        onOk() {
                            that.getStorageDocument();
                        },
                        onCancel() {
                            that.getStorageDocument();
                        }
                    });
                }
            })
            .catch(function (error) {
                console.log('error', error);
                that.setState({ loading: false });
                notification.error({
                    message: that.props.intl.formatMessage({ id: 'error' })
                });
                that.getStorageDocument();
            });
    };

    getWarehouses = async () => {
        const warehouses = await fetchAPI('GET', '/warehouses');
        const operationCode = _.get(this.props, 'location.state.operationCode');
        const locationType = _.get(this.props, 'location.state.formData.type');
        const locationDocumentType = _.get(this.props, 'location.state.formData.documentType');
        const { type: typeFromOperationCode, documentType: documentTypeFromOperationCode } =
            constants.getStoreDocByOperationCode(operationCode);
        const type = typeFromOperationCode || locationType;
        const documentType = documentTypeFromOperationCode || locationDocumentType;
        let mainWarehouseId = null;
        let reserveWarehouseId = null;
        let toolWarehouseId = null;
        let repairAreaWarehouseId = null;
        let storageWarehouseId = null;
        warehouses.map(warehouse => {
            switch (warehouse.attribute) {
                case constants.MAIN:
                    mainWarehouseId = warehouse.id;
                    break;
                case constants.RESERVE:
                    reserveWarehouseId = warehouse.id;
                    break;
                case constants.TOOL:
                    toolWarehouseId = warehouse.id;
                    break;
                case constants.REPAIR_AREA:
                    repairAreaWarehouseId = warehouse.id;
                    break;
                case constants.STORAGE:
                    storageWarehouseId = warehouse.id;
                    break;
                default:
                    break;
            }
        });
        if (warehouses.length) {
            let { incomeWarehouseId, expenseWarehouseId } = this.state.formData;
            let defaultWarehouseId = _.get(this.props.user, 'warehouseId');
            if (defaultWarehouseId) {
                const defaultWarehouse = warehouses.find(({ id }) => id === defaultWarehouseId);
                if (
                    defaultWarehouse &&
                    defaultWarehouse.attribute === 'STORAGE' &&
                    this.state.formData.operationCode &&
                    !showStorageWarehouses.includes(this.state.formData.operationCode)
                ) {
                    defaultWarehouseId = undefined;
                }
            }
            switch (type) {
                case constants.INCOME:
                    incomeWarehouseId = defaultWarehouseId || mainWarehouseId;
                    break;
                case constants.EXPENSE:
                    expenseWarehouseId = defaultWarehouseId || mainWarehouseId;
                    break;
                case constants.TRANSFER:
                    expenseWarehouseId = defaultWarehouseId || mainWarehouseId;
                    break;
                case constants.ORDER:
                    incomeWarehouseId = defaultWarehouseId || mainWarehouseId;
                    break;
                default:
                    incomeWarehouseId = defaultWarehouseId || mainWarehouseId;
            }
            if (documentType === constants.REPAIR_AREA) {
                expenseWarehouseId = toolWarehouseId;
                incomeWarehouseId = repairAreaWarehouseId;
            } else if (documentType === constants.TOOL) {
                expenseWarehouseId = repairAreaWarehouseId;
                incomeWarehouseId = toolWarehouseId;
            }
            if (documentType === constants.PRESERVATION) {
                if (type === constants.INCOME) {
                    incomeWarehouseId = storageWarehouseId;
                } else {
                    expenseWarehouseId = storageWarehouseId;
                }
            }
            this.state.formData.type = type || constants.INCOME;
            this.state.formData.documentType =
                documentType ||
                (type ? constants.typeToDocumentType[type.toLowerCase()].documentType[0] : constants.SUPPLIER);
            this.state.formData.incomeWarehouseId = incomeWarehouseId;
            this.state.formData.expenseWarehouseId = expenseWarehouseId;
        }
        const callback = () => {
            if (this.props.id) {
                this.getStorageDocument();
                this.getCells();
            }
        };
        this.setState(
            {
                warehouses,
                mainWarehouseId,
                storageWarehouseId,
                reserveWarehouseId,
                toolWarehouseId,
                repairAreaWarehouseId,
                fetched: !this.props.id
            },
            callback
        );
    };

    getEmployees() {
        const that = this;
        const token = localStorage.getItem('_my.carbook.pro_token');
        const url = `${__API_URL__}/employees`;
        fetch(url, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        })
            .then(function (response) {
                if (response.status !== 200) {
                    return Promise.reject(new Error(response.statusText));
                }

                return Promise.resolve(response);
            })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                data.map(elem => {
                    elem.phone = `+38(${elem.phone.substring(2, 5)}) ${elem.phone.substring(
                        5,
                        8
                    )}-${elem.phone.substring(8, 10)}-${elem.phone.substring(10)}`;
                });
                data = data.filter(elem => !elem.disabled);
                that.setState({
                    employees: data
                });
            })
            .catch(function (error) {
                console.log('error', error);
            });
    }

    getCounterpartSupplier = async query => {
        const counterpartSupplier = await fetchAPI('GET', 'business_suppliers', {
            all: true,
            cut: true,
            query
        });
        this.setState({
            counterpartSupplier
        });
    };

    getBusinessRequisites() {
        const that = this;
        const token = localStorage.getItem('_my.carbook.pro_token');
        const url = `${__API_URL__}/businesses/requisites`;
        fetch(url, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        })
            .then(function (response) {
                if (response.status !== 200) {
                    return Promise.reject(new Error(response.statusText));
                }

                return Promise.resolve(response);
            })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                that.setState({
                    businessRequisites: data
                });
            })
            .catch(function (error) {
                console.log('error', error);
            });
    }

    getBusinessSupplierRequisites(businessSupplierId) {
        const that = this;
        const token = localStorage.getItem('_my.carbook.pro_token');
        const url = `${__API_URL__}/business_suppliers/${businessSupplierId}`;
        fetch(url, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        })
            .then(function (response) {
                if (response.status !== 200) {
                    return Promise.reject(new Error(response.statusText));
                }

                return Promise.resolve(response);
            })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                that.setState({
                    businessSupplierRequisites: data.requisites
                });
            })
            .catch(function (error) {
                console.log('error', error);
            });
    }

    fetchSupplierRequisites = supplierId => {
        this.getBusinessSupplierRequisites(supplierId);
    };

    getClientRequisites(clientId) {
        const that = this;
        const token = localStorage.getItem('_my.carbook.pro_token');
        const url = `${__API_URL__}/clients/${clientId}`;
        fetch(url, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        })
            .then(function (response) {
                if (response.status !== 200) {
                    return Promise.reject(new Error(response.statusText));
                }

                return Promise.resolve(response);
            })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                that.setState({
                    clientRequisites: data.requisites
                });
            })
            .catch(function (error) {
                console.log('error', error);
            });
    }

    fetchClientRequisites = clientId => {
        this.getClientRequisites(clientId);
    };

    updateCounterpartData = counterpartId => {
        this.getCounterpartSupplier();
        this.updateFormData({
            counterpartId
        });
    };

    updateCounterpartClientData = counterpartId => {
        this.updateFormData({
            counterpartId
        });
    };

    getCells = async () => {
        const { formData } = this.state;
        if (formData.incomeWarehouseId && formData.type == constants.INCOME) {
            const cells = await fetchAPI('GET', 'wms/cells', {
                warehouseId: formData.incomeWarehouseId
            });
            this.setState({
                cells: cells.list
            });
        }
    };

    getBrands() {
        const that = this;
        const token = localStorage.getItem('_my.carbook.pro_token');
        const url = `${__API_URL__}/brands`;
        fetch(url, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        })
            .then(function (response) {
                if (response.status !== 200) {
                    return Promise.reject(new Error(response.statusText));
                }

                return Promise.resolve(response);
            })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                that.setState({
                    brands: data
                });
            })
            .catch(function (error) {
                console.log('error', error);
            });
    }

    getClientList = value => {
        const that = this;
        const token = localStorage.getItem('_my.carbook.pro_token');
        const url = `${__API_URL__}/clients/simple/search?query=${value}`;
        fetch(url, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        })
            .then(function (response) {
                if (response.status !== 200) {
                    return Promise.reject(new Error(response.statusText));
                }

                return Promise.resolve(response);
            })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                that.setState({
                    clientList: data
                });
            })
            .catch(function (error) {
                console.log('error', error);
            });
    };

    getStorageDocument = () => {
        const that = this;
        const token = localStorage.getItem('_my.carbook.pro_token');
        const url = `${__API_URL__}/store_docs/${this.props.id}`;
        fetch(url, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        })
            .then(function (response) {
                if (response.status !== 200) {
                    return Promise.reject(new Error(response.statusText));
                }

                return Promise.resolve(response);
            })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                that.state.requestData = { ...data };

                data.ctpType = undefined;
                data.counterpartId =
                    data.counterpartBusinessSupplierId || data.counterpartClientId || data.counterpartEmployeeId;
                data.clientName = data.counterpartClientName;
                data.clientPhone = data.counterpartClientPhones;
                data.payUntilDatetime = data.payUntilDatetime && dayjs(data.payUntilDatetime);
                data.doneDatetime = data.doneDatetime && dayjs(data.doneDatetime);
                data.sum = Math.abs(data.sum);
                data.sellingSum = Math.abs(data.sellingSum);
                data.quantity = Math.abs(data.quantity);
                data.docProducts.map((elem, key) => {
                    elem.brandId = elem.product.brandId;
                    elem.brandName = elem.product.brand && elem.product.brand.name;
                    elem.detailCode = elem.product.code;
                    elem.detailName = elem.product.name;
                    elem.groupId = elem.product.groupId;
                    elem.tradeCode = elem.product.tradeCode || elem.supplierPartNumber;
                    elem.sum = elem.stockPrice * elem.quantity;
                    elem.key = key;
                    elem.sellingSum = elem.sellingPrice * elem.quantity;
                    elem.purchasePrice = elem.purchasePrice || elem.stockPrice;
                    elem.uktz;
                    elem.orderId;
                    elem.docProductUnitId;
                    elem.getFromAddress;
                    elem.addToAddress;
                });
                switch (data.operationCode) {
                    case constants.INC:
                    case constants.CRT:
                    case constants.STP:
                        data.type = constants.INCOME;
                        break;
                    case constants.OUT:
                    case constants.AUT:
                    case constants.SRT:
                    case constants.CST:
                    case constants.STM:
                        data.type = constants.EXPENSE;
                        break;

                    case constants.TSF:
                        data.type = constants.TRANSFER;
                        data.documentType = constants.TRANSFER;
                        break;
                    case constants.RES:
                        data.type = constants.TRANSFER;
                        data.documentType = constants.RESERVE;
                        break;
                    case constants.TOL:
                        data.type = constants.TRANSFER;
                        data.documentType = constants.REPAIR_AREA;
                        break;
                    case constants.TOR:
                        data.type = constants.TRANSFER;
                        data.documentType = constants.TOOL;
                        break;
                    case constants.ORD:
                    case constants.BOR:
                        data.type = constants.ORDER;
                        break;
                    case constants.COM:
                        data.type = constants.ORDER;
                        data.documentType = constants.ORDERINCOME;
                        data.incomeWarehouseId = data.warehouseId;
                        break;
                    case constants.KPP:
                        data.type = constants.INCOME;
                        data.documentType = constants.PRESERVATION;
                        data.ctpType = data.counterpartBusinessSupplierId
                            ? constants.SUPPLIER_CTP
                            : constants.CLIENT_CTP;

                        break;
                    case constants.KPM:
                        data.type = constants.EXPENSE;
                        data.documentType = constants.PRESERVATION;
                        data.ctpType = data.counterpartBusinessSupplierId
                            ? constants.SUPPLIER_CTP
                            : constants.CLIENT_CTP;

                        break;
                }

                switch (data.type) {
                    case constants.INCOME:
                        data.incomeWarehouseId = data.warehouseId;
                        break;
                    case constants.EXPENSE:
                        data.expenseWarehouseId = data.warehouseId;
                        break;
                    case constants.TRANSFER:
                        data.incomeWarehouseId = data.counterpartWarehouseId;
                        data.expenseWarehouseId = data.warehouseId;
                        break;
                    case constants.ORDER:
                        data.incomeWarehouseId = data.incomeWarehouseId
                            ? data.incomeWarehouseId
                            : data.warehouseId
                            ? data.warehouseId
                            : that.state.warehouses.length
                            ? that.state.warehouses[0].id
                            : undefined;
                        break;
                }

                that.setState(
                    {
                        formData: data,
                        loading: false,
                        fetched: true
                    },
                    () => {
                        if (_.get(that.state, 'formData.businessSupplier.id')) {
                            that.getBusinessSupplierRequisites(that.state.formData.businessSupplier.id);
                        }

                        if (_.get(that.state, 'formData.counterpartClientId')) {
                            that.getClientRequisites(that.state.formData.counterpartClientId);
                        }
                    }
                );
            })
            .catch(function (error) {
                console.log('error', error);
                that.setState({ loading: true });
            });
    };

    /**
     * This modal is used to open and initialize cash order modal
     */
    openCashOrderModal = () => {
        const { operationCode, counterpartBusinessSupplierId, id, remainSum, documentType, type } = this.state.formData;
        const { cashOrderType } = storageDocumentMapper(operationCode);

        if (remainSum < 0 || operationCode == constants.OUT) {
            if (documentType == constants.CLIENT) {
                this.props.setModal(MODALS.REFACTORED_CASH_ORDER, {
                    initValues: {
                        type: cashOrderType,
                        counterpartyType: COUNTERPARTY_TYPES.CLIENT,
                        sum: Math.abs(remainSum), // Only positive numbers can be supplied here
                        clientStoreDocId: id
                    },
                    onCashOrderCreatedCallback: () => {
                        this.getStorageDocument();
                    }
                });
            } else {
                this.props.setModal(MODALS.REFACTORED_CASH_ORDER, {
                    initValues: {
                        type: cashOrderType,
                        counterpartyType: COUNTERPARTY_TYPES.BUSINESS_SUPPLIER,
                        sum: Math.abs(remainSum), // Only positive numbers can be supplied here
                        supplierId: counterpartBusinessSupplierId,
                        supplierStoreDocId: id
                    },
                    onCashOrderCreatedCallback: () => {
                        this.getStorageDocument();
                    }
                });
            }
        } else if (remainSum > 0) {
            if (type == constants.EXPENSE && documentType == constants.SUPPLIER) {
                this.props.setModal(MODALS.REFACTORED_CASH_ORDER, {
                    initValues: {
                        type: cashOrderType,
                        counterpartyType: COUNTERPARTY_TYPES.BUSINESS_SUPPLIER,
                        sum: Math.abs(remainSum), // Only positive numbers can be supplied here
                        supplierId: counterpartBusinessSupplierId,
                        supplierStoreDocId: id
                    },
                    onCashOrderCreatedCallback: () => {
                        this.getStorageDocument();
                    }
                });
            } else if (documentType == constants.CLIENT) {
                this.props.setModal(MODALS.REFACTORED_CASH_ORDER, {
                    initValues: {
                        type: cashOrderType,
                        counterpartyType: COUNTERPARTY_TYPES.CLIENT,
                        sum: Math.abs(remainSum), // Only positive numbers can be supplied here
                        clientStoreDocId: id
                    },
                    onCashOrderCreatedCallback: () => {
                        this.getStorageDocument();
                    }
                });
            } else {
                this.props.setModal(MODALS.REFACTORED_CASH_ORDER, {
                    initValues: {
                        type: cashOrderType,
                        counterpartyType: COUNTERPARTY_TYPES.BUSINESS_SUPPLIER,
                        sum: Math.abs(remainSum), // Only positive numbers can be supplied here
                        supplierId: counterpartBusinessSupplierId,
                        supplierStoreDocId: id
                    },
                    onCashOrderCreatedCallback: () => {
                        this.getStorageDocument();
                    }
                });
            }
        }
    };

    handleStoreDocServices = () => {
        setTimeout(this.getStorageDocument, 1000);
    };

    componentDidMount() {
        this._isMounted = true;
        const { id, location } = this.props;

        if (this._isMounted) {
            if (location.state && location.state.showForm) {
                const { formData } = location.state || {};
                this.updateFormData(location.state.formData);
            }
            this.getWarehouses();
        }

        this.getBrands();
        this.getCounterpartSupplier();
        this.getEmployees();
        this.getBusinessRequisites();
    }

    componentWillUnmount() {
        this._isMounted = false;
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.state.forceUpdate) {
            this.setState({
                forceUpdate: false
            });
        }
    }

    render() {
        const {
            data,
            warehouses,
            counterpartSupplier,
            employees,
            formData,
            brands,
            clientList,
            fetched,
            forceUpdate,
            loading,
            mainWarehouseId,
            storageWarehouseId,
            reserveWarehouseId,
            toolWarehouseId,
            repairAreaWarehouseId,
            cells,
            businessRequisites,
            businessSupplierRequisites,
            clientRequisites,
            visibleCopyStorageDocModal,
            visibleAddOrderFromDocumentModal,
            productsToAdd
        } = this.state;

        const {
            id,
            intl: { formatMessage },
            user,
            modal,
            setModal,
            resetModal,
            modalProps
        } = this.props;

        const { copyTypes } = storageDocumentMapper(formData.operationCode);
        const dateTime = formData.createdDatetime || new Date();
        const titleType = ` ${formatMessage({
            id: `storage_document.docType.${formData.type}.${formData.documentType}`
        }).toLowerCase()}`;

        this.state.warnings = 0;
        formData.docProducts.map((elem, i) => {
            elem.key = i;
            if (!elem.productId) {
                // this.state.warnings++;
                setTimeout(() => this.updateDocument(true), 500);
            }
        });

        return !fetched ? (
            <Spinner spin />
        ) : (
            <Layout
                controls={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {id ? (
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                {formData.documentType === constants.PRESERVATION && formData.counterpartClientId && (
                                    <Button
                                        icon={
                                            formData.orderId ? (
                                                <FileSearchOutlined style={{ fontSize: 24 }} />
                                            ) : (
                                                <FileAddOutlined style={{ fontSize: 24 }} />
                                            )
                                        }
                                        onClick={() => {
                                            formData.orderId
                                                ? Modal.confirm({
                                                      title: this.props.intl.formatMessage({
                                                          id: 'add_order_from_doc'
                                                      }),
                                                      onOk: () => {
                                                          goTo(`${book.order}/${formData.orderId}`);
                                                      },
                                                      okType: 'default',
                                                      onCancel: () => {
                                                          this.updateDocument();
                                                      }
                                                  })
                                                : this.setState({
                                                      visibleAddOrderFromDocumentModal: true
                                                  });
                                        }}
                                        size='large'
                                        style={{ marginLeft: 8 }}
                                        type='text'
                                    />
                                )}
                                <ChangeStatusDropdown
                                    data-qa='change_status_document_storage_document_page'
                                    disabled={loading}
                                    docProducts={formData.docProducts}
                                    documentType={formData.documentType}
                                    incomeOnlyWithCell={formData.incomeOnlyWithCell}
                                    operationCode={formData.operationCode}
                                    setModal={setModal}
                                    status={formData.status}
                                    type={formData.type}
                                    updateDocument={this.updateFormData}
                                    user={user}
                                />
                                <Tooltip title={<FormattedMessage id='directory_page.import_document' />}>
                                    <Button
                                        data-qa='button_import_receipt_document_modal_storage_document_page'
                                        icon={<ImportOutlined style={{ fontSize: 24 }} />}
                                        onClick={() => setModal(MODALS.IMPORT_RECEIPT_DOCUMENT_MODAL)}
                                        size='large'
                                        style={{ marginLeft: 8 }}
                                        type='text'
                                    />
                                </Tooltip>
                                {id &&
                                formData.status === constants.DONE &&
                                formData.operationCode != constants.AUT &&
                                (formData.documentType == constants.SERVICE ||
                                    formData.documentType == constants.SUPPLIER ||
                                    formData.documentType == constants.CLIENT) &&
                                formData.context == 'STOCK' &&
                                _.get(this.state, 'formData.remainSum') ? (
                                    <Button
                                        data-qa='button_open_cash_order_modal_storage_document_page'
                                        icon={<DollarOutlined style={{ fontSize: 24 }} />}
                                        onClick={this.openCashOrderModal}
                                        size='large'
                                        style={{ marginLeft: 8 }}
                                        type='text'
                                    />
                                ) : null}
                                <Barcode
                                    buttonStyle={{ marginLeft: 8 }}
                                    data-qa='barcode_storage_document_page'
                                    iconStyle={{ fontSize: 24 }}
                                    onConfirm={() => {
                                        this.getStorageDocument();
                                    }}
                                    prefix='STD'
                                    referenceId={id}
                                    table='STORE_DOCS'
                                    value={formData.barcode || formData.documentNumber}
                                />
                                <ReportsDropdown documentType={formData.documentType} id={id} />
                            </div>
                        ) : null}
                        {formData.status == constants.DONE && formData.type == constants.ORDER && (
                            <Tooltip
                                title={
                                    formData.externalApiOrderStatus === 'SENT'
                                        ? formatMessage({ id: 'sent' })
                                        : formatMessage({ id: 'send' })
                                }
                            >
                                <Button
                                    data-qa='button_sent_mail_modal_storage_document_page'
                                    icon={<MailOutlined style={{ fontSize: 24 }} />}
                                    onClick={() => {
                                        if (formData.externalApiOrderStatus === 'SENT') {
                                            return;
                                        }
                                        this.updateFormData({ externalApiOrderStatus: 'SENT' }, true, () => {
                                            notification.success({
                                                message: formatMessage({ id: 'sent' })
                                            });
                                        });
                                    }}
                                    size='large'
                                    style={{
                                        marginLeft: 8,
                                        color: formData.externalApiOrderStatus === 'SENT' ? 'var(--text2)' : null
                                    }}
                                    type='text'
                                />
                            </Tooltip>
                        )}
                        <Tooltip title={<FormattedMessage id='directory_page.document_number' />}>
                            <Button
                                data-qa='button_reference_book_add_modal_storage_document_page'
                                icon={<LinkOutlined style={{ fontSize: 24 }} />}
                                onClick={() => setModal(MODALS.REFERENCE_BOOK_ADD_MODAL)}
                                size='large'
                                style={{ marginLeft: 8 }}
                                type='text'
                            />
                        </Tooltip>
                        {formData.status !== constants.DONE && (
                            <div style={{ display: 'flex' }}>
                                {formData.type == constants.ORDER &&
                                    ((!isForbidden(user, permissions.ACCESS_SUPPLIER_ORDER_STORE_DOCS_AUTO) &&
                                        formData.documentType == constants.SUPPLIER) ||
                                        (!isForbidden(user, permissions.ACCESS_INCOME_STORE_DOCS_AUTO) &&
                                            formData.documentType == constants.ORDERINCOME) ||
                                        formData.documentType == constants.ADJUSTMENT) && (
                                        <AutomaticOrderCreationModal
                                            addDocProduct={this.addDocProduct}
                                            disabled={formData.status != constants.NEW}
                                            documentType={formData.documentType}
                                            supplierId={formData.counterpartId}
                                            type={formData.type}
                                        />
                                    )}
                                {((formData.type == constants.INCOME && formData.documentType == constants.CLIENT) ||
                                    (formData.type == constants.EXPENSE &&
                                        formData.documentType == constants.SUPPLIER)) && (
                                    <ReturnModal
                                        addDocProduct={this.addDocProduct}
                                        brands={brands}
                                        counterpartId={formData.counterpartId}
                                        disabled={formData.status != constants.NEW}
                                        documentType={formData.documentType}
                                        type={formData.type}
                                        user={user}
                                    />
                                )}
                            </div>
                        )}

                        <Badge count={this.state.warnings} style={{ backgroundColor: 'var(--approve)' }}>
                            <Button
                                data-qa='button_update_or_create_document_storage_document_page'
                                icon={<SaveOutlined style={{ fontSize: 24 }} />}
                                onClick={() => {
                                    if (id) {
                                        this.updateDocument(true);
                                    } else {
                                        this.createDocument();
                                    }
                                }}
                                size='large'
                                style={{ marginLeft: 8 }}
                                type='text'
                            />
                        </Badge>

                        {id && copyTypes.length > 0 && (
                            <Button
                                data-qa='button_copy_document_storage_document_page'
                                icon={<CopyOutlined style={{ fontSize: 24 }} />}
                                onClick={() => {
                                    this.setState({ visibleCopyStorageDocModal: true });
                                }}
                                size='large'
                                style={{ marginLeft: 8 }}
                                type='text'
                            />
                        )}
                        {id && formData.status !== constants.DONE && (
                            <Popconfirm
                                data-qa='popconfirm_delete_post_storage_document_page'
                                onConfirm={() => {
                                    const that = this;
                                    const token = localStorage.getItem('_my.carbook.pro_token');
                                    const url = `${__API_URL__}/store_docs/${this.props.id}`;
                                    fetch(url, {
                                        method: 'DELETE',
                                        headers: {
                                            Authorization: token
                                        }
                                    })
                                        .then(function (response) {
                                            if (response.status !== 200) {
                                                return Promise.reject(new Error(response.statusText));
                                            }

                                            return Promise.resolve(response);
                                        })
                                        .then(function (response) {
                                            return response.json();
                                        })
                                        .then(function (data) {
                                            that.props.history.goBack();
                                        })
                                        .catch(function (error) {
                                            console.log('error', error);
                                        });
                                }}
                                placement='bottom'
                                title={formatMessage({
                                    id: 'add_order_form.delete_confirm'
                                })}
                                type='danger'
                            >
                                <Button
                                    icon={<DeleteOutlined style={{ fontSize: 24 }} />}
                                    size='large'
                                    style={{ marginLeft: 8 }}
                                    type='text'
                                />
                            </Popconfirm>
                        )}
                        <Button
                            data-qa='button_delete_post_storage_document_page'
                            icon={<CloseOutlined style={{ fontSize: 24 }} />}
                            onClick={() => {
                                this.props.history.goBack();
                            }}
                            size='large'
                            style={{ marginLeft: 8 }}
                            type='text'
                        />
                    </div>
                }
                description={
                    <div>
                        <FormattedMessage id='order-page.creation_date' />
                        {`: ${dayjs(dateTime).format('DD MMMM YYYY, HH:mm')}`}
                    </div>
                }
                title={
                    id ? (
                        <span>
                            {formData.status == 'NEW' ? (
                                <FormattedMessage id='storage_document.status_created' />
                            ) : (
                                <FormattedMessage id='storage_document.status_confirmed' />
                            )}
                            {titleType} {formData.documentNumber}
                        </span>
                    ) : (
                        <FormattedMessage id='storage.new_document' />
                    )
                }
            >
                <StorageDocumentForm
                    addDocProduct={this.addDocProduct}
                    addPartsToOrder={this.addPartsToOrder}
                    brands={brands}
                    businessRequisites={businessRequisites}
                    businessSupplierRequisites={businessSupplierRequisites}
                    cells={cells}
                    clientList={clientList}
                    clientRequisites={clientRequisites}
                    counterpartSupplier={counterpartSupplier}
                    createDocument={this.createDocument}
                    deleteDocProduct={this.deleteDocProduct}
                    editDocProduct={this.editDocProduct}
                    employees={employees}
                    fetchClientRequisites={this.fetchClientRequisites}
                    fetchStorageDocument={this.getStorageDocument}
                    fetchSupplierRequisites={this.fetchSupplierRequisites}
                    forceUpdate={forceUpdate}
                    formData={formData}
                    getClientList={this.getClientList}
                    getCounterpartSupplier={this.getCounterpartSupplier}
                    handleStoreDocServices={this.handleStoreDocServices}
                    hideAddOrderModal={() => this.setState({ visibleAddOrderFromDocumentModal: false })}
                    id={id}
                    loading={loading}
                    mainWarehouseId={mainWarehouseId}
                    repairAreaWarehouseId={repairAreaWarehouseId}
                    reserveWarehouseId={reserveWarehouseId}
                    setModal={setModal}
                    storageWarehouseId={storageWarehouseId}
                    toolWarehouseId={toolWarehouseId}
                    typeToDocumentType={constants.typeToDocumentType}
                    updateCounterpartClientData={this.updateCounterpartClientData}
                    updateCounterpartData={this.updateCounterpartData}
                    updateDocument={this.updateDocument}
                    updateFormData={this.updateFormData}
                    user={user}
                    visibleAddOrderFromDocumentModal={visibleAddOrderFromDocumentModal}
                    warehouses={warehouses}
                    wrappedComponentRef={this.saveFormRef}
                />
                <ToSuccessModal
                    clientId={formData.documentType == constants.CLIENT ? formData.counterpartId : undefined}
                    onSubmit={() => {
                        this.updateFormData({ status: constants.DONE }, true, () => {
                            window.location.reload();
                        });
                    }}
                    reload={() => this.getStorageDocument()}
                    remainPrice={formData.remainSum}
                    resetModal={resetModal}
                    storeDocId={id}
                    visible={modal}
                />
                <ReferenceBookAddModal resetModal={() => resetModal()} storeDocId={id} user={user} visible={modal} />
                <ImportReceiptDocumentModal
                    documentType={formData.documentType}
                    onConfirm={this.getStorageDocument}
                    resetModal={() => resetModal()}
                    status={formData.status}
                    storeDocId={id}
                    suppliers={counterpartSupplier}
                    updateDocument={this.updateDocument}
                    visible={modal}
                />
                <RefactoredCashOrderModal />
                <CopyStorageDocModal
                    copyTypes={copyTypes}
                    formData={formData}
                    hideModal={() => {
                        this.setState({ visibleCopyStorageDocModal: false });
                    }}
                    id={id}
                    visible={visibleCopyStorageDocModal}
                />
                <ProductsToAddModal
                    addPartsToOrder={ids => this.addPartsToOrder(ids, true)}
                    hideModal={() => {
                        this.setState({ productsToAdd: null });
                    }}
                    products={productsToAdd}
                />
            </Layout>
        );
    }
}

export default StorageDocumentPage;

@injectIntl
class ChangeStatusDropdown extends React.Component {
    constructor(props) {
        super(props);

        this.state = {};
    }

    render() {
        const {
            status,
            user,
            incomeOnlyWithCell,
            type,
            documentType,
            setModal,
            updateDocument,
            docProducts,
            disabled: db,
            intl: { formatMessage }
        } = this.props;
        let isAllWithCells = true;

        if (incomeOnlyWithCell && (type === constants.INCOME || type === constants.ORDER)) {
            docProducts.forEach(({ addToAddress }) => {
                if (!addToAddress) {
                    isAllWithCells = false;
                }
            });
        }

        const disabled =
            db || (incomeOnlyWithCell && (type === constants.INCOME || type === constants.ORDER) && !isAllWithCells);

        const menu = (
            <Menu>
                {status === constants.NEW ? (
                    <Menu.Item
                        data-qa='menu_item_status_done_storage_document_page'
                        disabled={disabled}
                        onClick={() => {
                            if (type === constants.EXPENSE && documentType === constants.CLIENT) {
                                setModal(MODALS.TO_SUCCESS);
                            } else {
                                let hasOrderId = false;
                                docProducts.forEach(product => {
                                    if (product.orderId) {
                                        hasOrderId = true;
                                    }
                                });
                                if (hasOrderId && !['ORD', 'BOR'].includes(this.props.operationCode)) {
                                    confirm({
                                        title: formatMessage({
                                            id: 'order-page.add_product_to_order'
                                        }),
                                        onOk: () => {
                                            // if orderId display in row add Products to order
                                            //! !!
                                            updateDocument({ status: constants.DONE, isAddToOrder: true }, true);
                                        },
                                        onCancel: () => {
                                            updateDocument({ status: constants.DONE }, true);
                                        }
                                    });
                                } else {
                                    updateDocument({ status: constants.DONE }, true);
                                }
                            }
                        }}
                        title={disabled && formatMessage({ id: 'order_form_table.not_every_product_has_cell' })}
                    >
                        <FormattedMessage id='storage_document.status_confirmed' />
                    </Menu.Item>
                ) : !isForbidden(user, permissions.UPDATE_SUCCESS_ORDER) ? (
                    <Menu.Item
                        data-qa='menu_item_status_new_storage_document_page'
                        disabled={db}
                        onClick={() => {
                            confirm({
                                title: formatMessage({
                                    id: 'order-page.change_status_to_new'
                                }),
                                onOk: () => {
                                    updateDocument({ status: constants.NEW }, true);
                                }
                            });
                        }}
                    >
                        <FormattedMessage id='storage_document.status_created' />
                    </Menu.Item>
                ) : null}
            </Menu>
        );

        return (
            (status === constants.NEW ||
                (status === constants.DONE && !isForbidden(user, permissions.UPDATE_SUCCESS_ORDER))) && (
                <Dropdown data-qa='dropdown_change_status_storage_document_page' overlay={menu}>
                    <Button icon={<SwapOutlined style={{ fontSize: 24 }} />} style={{ padding: '4px 8px' }} type='text'>
                        <span style={{ verticalAlign: 'text-bottom' }}>
                            <FormattedMessage id='change_status_dropdown.change_status' />
                        </span>
                    </Button>
                </Dropdown>
            )
        );
    }
}

class ReportsDropdown extends React.Component {
    render() {
        const menu = (
            <Menu>
                <Menu.Item
                    data-qa='menu_item_document_storage_document_page'
                    onClick={async () => {
                        const response = await fetchAPI(
                            'GET',
                            `orders/reports/${this.props.id}`,
                            { type: 'documentReport' },
                            null,
                            { rawResponse: true, handleErrorInternally: true }
                        );
                        const reportFile = await response.blob();

                        const contentDispositionHeader = response.headers.get('content-disposition');
                        const fileName = contentDispositionHeader.match(/^attachment; filename="(.*)"/)[1];
                        await saveAs(reportFile, fileName);
                    }}
                >
                    <FormattedMessage id='storage_document.document' />
                </Menu.Item>
                {this.props.documentType === constants.PRESERVATION && (
                    <React.Fragment>
                        {' '}
                        <Menu.Item
                            data-qa='menu_item_document_storage_document_page'
                            onClick={async () => {
                                const response = await fetchAPI(
                                    'GET',
                                    `orders/reports/${this.props.id}`,
                                    { type: 'documentAcceptanceReport' },
                                    null,
                                    { rawResponse: true, handleErrorInternally: true }
                                );
                                const reportFile = await response.blob();

                                const contentDispositionHeader = response.headers.get('content-disposition');
                                const fileName = contentDispositionHeader.match(/^attachment; filename="(.*)"/)[1];
                                await saveAs(reportFile, fileName);
                            }}
                        >
                            <FormattedMessage id='actOfAcceptanceReport' />
                        </Menu.Item>
                        <Menu.Item
                            data-qa='menu_item_document_storage_document_page'
                            onClick={async () => {
                                const response = await fetchAPI(
                                    'GET',
                                    `orders/reports/${this.props.id}`,
                                    { type: 'tags' },
                                    null,
                                    { rawResponse: true, handleErrorInternally: true }
                                );
                                const reportFile = await response.blob();

                                const contentDispositionHeader = response.headers.get('content-disposition');
                                const fileName = contentDispositionHeader.match(/^attachment; filename="(.*)"/)[1];
                                await saveAs(reportFile, fileName);
                            }}
                        >
                            <FormattedMessage id='storage_document.tags' />
                        </Menu.Item>
                    </React.Fragment>
                )}
                <Menu.Item
                    data-qa='menu_item_xlsx_storage_document_page'
                    onClick={async () => {
                        const response = await fetchAPI('GET', `store_docs/${this.props.id}/xlsx`, null, null, {
                            rawResponse: true,
                            handleErrorInternally: true
                        });
                        const reportFile = await response.blob();

                        const contentDispositionHeader = response.headers.get('content-disposition');
                        const fileName = contentDispositionHeader.match(/^attachment; filename="(.*)"/)[1];
                        await saveAs(reportFile, fileName);
                    }}
                >
                    XLSX
                </Menu.Item>
            </Menu>
        );

        return (
            <Dropdown data-qa='dropdown_file_document_storage_document_page' overlay={menu}>
                <Button
                    icon={<PrinterOutlined style={{ fontSize: 24 }} />}
                    size='large'
                    style={{ marginLeft: 8 }}
                    type='text'
                />
            </Dropdown>
        );
    }
}

@injectIntl
class ReturnModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            visible: false,
            brandSearchValue: '',
            storageProducts: [],
            recommendedReturnsVisible: false,
            returnDataSource: [],
            selectedProduct: {
                brandId: undefined,
                brandName: undefined,
                detailCode: undefined,
                detailName: undefined,
                stockPrice: 0,
                quantity: 0,
                storeDocProductId: undefined
            }
        };

        this.returnTableColumns = () => [
            {
                title: <FormattedMessage id='storage_document.document' />,
                key: 'documentNumber',
                dataIndex: 'documentNumber'
            },
            {
                title: <FormattedMessage id='date' />,
                key: 'doneDatetime',
                dataIndex: 'doneDatetime',
                render: (doneDatetime, row) => {
                    return dayjs(doneDatetime).format('LL');
                }
            },
            {
                title: <FormattedMessage id='order_form_table.price' />,
                key: 'price',
                render: row => {
                    return this.props.documentType == constants.CLIENT ? row.stockPrice : row.sellingPrice;
                }
            },
            {
                title: <FormattedMessage id='order_form_table.count' />,
                key: 'returnQuantity',
                dataIndex: 'returnQuantity'
            },
            {
                title: <FormattedMessage id='order_form_table.sum' />,
                key: 'sum',
                dataIndex: 'sum'
            },
            {
                title: <FormattedMessage id='storage_document.return' />,
                key: 'quantity',
                dataIndex: 'quantity',
                render: (quantity, row) => {
                    return (
                        <InputNumber
                            data-qa='input_number_quantity_storage_document_page'
                            decimalSeparator=','
                            max={row.returnQuantity}
                            min={0}
                            onChange={value => {
                                row.quantity = value;
                                this.setState({});
                            }}
                            step={0.1}
                            value={quantity}
                        />
                    );
                }
            },
            {
                key: 'select',
                render: row => {
                    return (
                        <Button
                            data-qa='button_stockPrice_sellingPrice_storage_document_page'
                            disabled={!row.quantity}
                            onClick={() => {
                                this.state.selectedProduct.stockPrice = row.stockPrice || row.sellingPrice;
                                this.state.selectedProduct.quantity = row.quantity;
                                this.state.selectedProduct.storeDocProductId = row.storeDocProductId;
                                this.setState({
                                    recommendedReturnsVisible: false
                                });
                            }}
                            type='primary'
                        >
                            <FormattedMessage id='select' />
                        </Button>
                    );
                }
            }
        ];
    }

    handleOk() {
        this.props.addDocProduct(this.state.selectedProduct);
        this.handleCancel();
    }

    handleCancel() {
        this.setState({
            visible: false,
            recommendedReturnsVisible: false,
            returnDataSource: [],
            brandSearchValue: '',
            storageProducts: [],
            selectedProduct: {
                brandId: undefined,
                brandName: undefined,
                detailCode: undefined,
                detailName: undefined,
                stockPrice: 0,
                quantity: 0,
                storeDocProductId: undefined,
                productId: undefined
            }
        });
    }

    fetchReturnData() {
        const that = this;
        const token = localStorage.getItem('_my.carbook.pro_token');
        let url = `${__API_URL__}/store_docs/return?documentType=${this.props.documentType}&productId=${this.state.selectedProduct.productId}`;
        if (this.props.documentType == constants.CLIENT) {
            url += `&counterpartClientId=${this.props.counterpartId}`;
        } else {
            url += `&counterpartBusinessSupplierId=${this.props.counterpartId}`;
        }
        fetch(url, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        })
            .then(function (response) {
                if (response.status !== 200) {
                    return Promise.reject(new Error(response.statusText));
                }

                return Promise.resolve(response);
            })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                data.map((elem, i) => {
                    elem.key = i;
                    elem.quantity = elem.returnQuantity;
                    elem.sum = elem.sum;
                });
                that.setState({
                    returnDataSource: data
                });
            })
            .catch(function (error) {
                console.log('error', error);
            });
        AutoComplete;
    }

    getStorageProducts = async query => {
        const { list: storageProducts } = await fetchAPI('GET', 'store_products', { query, pageSize: 25 }, null, {
            handleErrorInternally: true
        });
        this.setState({ storageProducts });
    };

    render() {
        const { documentType, brands, user, disabled } = this.props;
        const { visible, storageProducts, selectedProduct, recommendedReturnsVisible, returnDataSource } = this.state;

        return (
            <div>
                <Button
                    data-qa='button_visible_return_modal_storage_document_page'
                    disabled={disabled}
                    icon={<RollbackOutlined style={{ fontSize: 24 }} />}
                    onClick={() => {
                        this.setState({
                            visible: true
                        });
                    }}
                    size='large'
                    style={{ marginLeft: 8 }}
                    type='text'
                />
                <Modal
                    maskClosable={false}
                    okButtonProps={{ disabled: !selectedProduct.storeDocProductId }}
                    onCancel={() => {
                        this.handleCancel();
                    }}
                    onOk={() => {
                        this.handleOk();
                    }}
                    visible={visible}
                    width='fit-content'
                >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-end',
                            margin: '24px 0 0 0'
                        }}
                    >
                        <div style={{ minWidth: 140 }}>
                            <FormattedMessage id='order_form_table.brand' />
                            <Select
                                data-qa='select_brandId_return_modal_storage_document_page'
                                disabled
                                dropdownStyle={{
                                    maxHeight: 400,
                                    overflow: 'auto',
                                    zIndex: '9999',
                                    minWidth: 220
                                }}
                                style={{ color: 'var(--text)' }}
                                value={selectedProduct.brandId}
                            >
                                {brands.map(elem => (
                                    <Option key={elem.brandId} supplier_id={elem.supplierId} value={elem.brandId}>
                                        {elem.brandName}
                                    </Option>
                                ))}
                            </Select>
                        </div>
                        <div>
                            <FormattedMessage id='order_form_table.detail_code' />
                            <AutoComplete
                                data-qa='select_detailCode_return_modal_storage_document_page'
                                dropdownStyle={{
                                    maxHeight: 400,
                                    overflow: 'auto',
                                    zIndex: '9999',
                                    minWidth: 220
                                }}
                                onChange={value => {
                                    this.setState(state => ({
                                        selectedProduct: {
                                            ...state.selectedProduct,
                                            detailCode: value
                                        }
                                    }));
                                    if (String(value).length >= 3) {
                                        this.getStorageProducts(String(value));
                                    }
                                }}
                                onSelect={(value, { brand, name, trade, id, docProductUnitId }) => {
                                    this.setState(state => ({
                                        selectedProduct: {
                                            ...state.selectedProduct,
                                            detailCode: value,
                                            brandId: brand,
                                            detailName: name,
                                            tradeCode: trade,
                                            productId: id,
                                            docProductUnitId
                                        }
                                    }));
                                }}
                                showSearch
                                style={{ color: 'var(--text)', minWidth: 180 }}
                                value={selectedProduct.detailCode}
                            >
                                {storageProducts.map(elem => (
                                    <Option
                                        brand={elem.brandId}
                                        id={elem.id}
                                        name={elem.name}
                                        trade={elem.tradeCode}
                                        value={elem.code}
                                    >
                                        {elem.code}
                                    </Option>
                                ))}
                            </AutoComplete>
                        </div>
                        <StockProductsModal
                            codeFilter={selectedProduct.detailCode}
                            selectProduct={product => {
                                const { code, brandId, name, tradeCode, id, docProductUnitId } = product;
                                this.setState(state => ({
                                    selectedProduct: {
                                        ...state.selectedProduct,
                                        detailCode: code,
                                        brandId,
                                        detailName: name,
                                        tradeCode,
                                        productId: id,
                                        docProductUnitId
                                    }
                                }));
                            }}
                            user={user}
                        />
                        {documentType === constants.SUPPLIER && (
                            <div>
                                <FormattedMessage id='order_form_table.detail_code' /> (
                                <FormattedMessage id='storage.supplier' />)
                                <Input
                                    data-qa='input_trandCode_return_modal_storage_document_page'
                                    disabled
                                    style={{
                                        color: 'var(--text)'
                                    }}
                                    value={selectedProduct.tradeCode}
                                />
                            </div>
                        )}
                        <div>
                            <FormattedMessage id='order_form_table.detail_name' />
                            <Input
                                data-qa='input_detailName_return_modal_storage_document_page'
                                disabled
                                style={{
                                    color: 'var(--text)'
                                }}
                                value={selectedProduct.detailName}
                            />
                        </div>
                        <div>
                            <div>
                                <FormattedMessage id='order_form_table.price' />
                            </div>
                            <InputNumber
                                data-qa='input_number_stockPrice_return_modal_storage_document_page'
                                decimalSeparator=','
                                min={0}
                                onChange={value => {
                                    selectedProduct.stockPrice = value;
                                    this.setState({});
                                }}
                                value={selectedProduct.stockPrice}
                            />
                        </div>
                        <div>
                            <div>
                                <FormattedMessage id='order_form_table.count' />
                            </div>
                            <InputNumber
                                data-qa='input_number_quantity_return_modal_storage_document_page'
                                decimalSeparator=','
                                min={1}
                                onChange={value => {
                                    selectedProduct.quantity = value;
                                    this.setState({});
                                }}
                                value={selectedProduct.quantity}
                            />
                        </div>
                        <div>
                            <div>
                                <FormattedMessage id='order_form_table.sum' />
                            </div>
                            <InputNumber
                                data-qa='input_number_quantity_stockPrice_return_modal_storage_document_page'
                                decimalSeparator=','
                                disabled
                                min={0}
                                style={{
                                    color: 'var(--text)'
                                }}
                                value={Math.round(selectedProduct.quantity * selectedProduct.stockPrice * 10) / 10}
                            />
                        </div>
                        <div>
                            <Button
                                data-qa='button_recommendedReturnsVisible_return_modal_storage_document_page'
                                disabled={!selectedProduct.detailCode}
                                onClick={() => {
                                    this.fetchReturnData();
                                    this.setState({
                                        recommendedReturnsVisible: true
                                    });
                                }}
                                type='primary'
                            >
                                <UnorderedListOutlined />
                            </Button>
                        </div>
                    </div>
                </Modal>
                <Modal
                    maskClosable={false}
                    onCancel={() => {
                        this.setState({
                            recommendedReturnsVisible: false
                        });
                    }}
                    onOk={() => {
                        this.setState({
                            recommendedReturnsVisible: false
                        });
                    }}
                    style={{
                        minWidth: '50%'
                    }}
                    visible={recommendedReturnsVisible}
                    width='fit-content'
                >
                    <Table bordered columns={this.returnTableColumns()} dataSource={returnDataSource} />
                </Modal>
            </div>
        );
    }
}
