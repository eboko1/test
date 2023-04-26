import {
    CheckCircleFilled,
    ClockCircleFilled,
    DeleteOutlined,
    QuestionCircleFilled
} from '@ant-design/icons';
import { Popconfirm } from 'antd';
import { Numeral } from 'commons';
import dayjs from 'dayjs';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router-dom';
import book from 'routes/book';
import { getCurrency } from 'utils';
import Styles from './styles.m.css';

/* eslint-disable complexity */
const INCOME = 'INCOME';
const EXPENSE = 'EXPENSE';
const RESERVE = 'RESERVE';
const SUPPLIER = 'SUPPLIER';
const CLIENT = 'CLIENT';
const INVENTORY = 'INVENTORY';
const OWN_CONSUMPTION = 'OWN_CONSUMPTION';
const TRANSFER = 'TRANSFER';
const ADJUSTMENT = 'ADJUSTMENT';
const ORDERINCOME = 'ORDERINCOME';
const ORDER = 'ORDER';
const NEW = 'NEW';
const DONE = 'DONE';

const INC = 'INC';
const CRT = 'CRT';
const STP = 'STP';
const OUT = 'OUT';
const SRT = 'SRT';
const CST = 'CST';
const STM = 'STM';
const TSF = 'TSF';
const RES = 'RES';
const ORD = 'ORD';
const BOR = 'BOR';
const COM = 'COM';

export function columnsConfig(isCRUDForbidden, activeRoute, listType, formatMessage, deleteAction) {
    let isOrder = false;
    let isTransfer = false;
    let isIncomes = false;
    let isExpense = false;

    switch (activeRoute) {
        case '/storage-orders':
            isOrder = true;
            break;
        case '/storage-incomes':
            isIncomes = true;
            break;
        case '/storage-expenses':
            isExpense = true;
            break;
        case '/storage-transfers':
            isTransfer = true;
            break;
        case '/supplier/:id':
            isOrder = true;
            break;
    }

    const sortOptions = {
        asc: 'ascend',
        desc: 'descend'
    };

    const orderCol = {
        title: <FormattedMessage id='storage_document.document' />,
        width: 100,
        dataIndex: 'supplierDocNumber',
        key: 'supplierDocNumber',
        // fixed:     'left',
        render: (_, document) => (
            <React.Fragment>
                <Link to={!isCRUDForbidden ? `${book.storageDocument}/${document.id}` : false}>
                    {document.documentNumber}
                </Link>
            </React.Fragment>
        )
    };

    const datetimeCol = {
        title: <FormattedMessage id='storage_document.date_done' />,
        dataIndex: 'doneDatetime',
        key: 'doneDatetime',
        sorter: (a, b) =>
            dayjs(a.doneDatetime).isAfter(b.doneDatetime)
                ? 1
                : dayjs(b.doneDatetime).isAfter(a.doneDatetime)
                ? -1
                : 0,
        width: 80,
        render: (_, document) => (
            <div>
                {document.doneDatetime ? (
                    dayjs(document.doneDatetime).format('DD.MM.YYYY HH:mm')
                ) : document.createdDatetime ? (
                    dayjs(document.createdDatetime).format('DD.MM.YYYY HH:mm')
                ) : (
                    <FormattedMessage id='long_dash' />
                )}
            </div>
        )
    };

    const invoiceNumberCol = {
        title: <FormattedMessage id='storage_document.invoice_number' />,
        dataIndex: 'docNumber',
        key: 'docNumber',
        width: 80,
        render: (_, document) => (
            <div>
                {document.docNumber ? document.docNumber : <FormattedMessage id='long_dash' />}
            </div>
        )
    };

    const counterpartyCol = {
        title: <FormattedMessage id='storage_document.counterparty' />,
        key: 'businessSupplier',
        width: 80,
        render: (_, document) => (
            <div>
                {document.counterpartBusinessSupplierName ||
                    document.counterpartClientName ||
                    document.counterpartEmployeeName || <FormattedMessage id='long_dash' />}
            </div>
        )
    };

    const counterpartyTypeCol = {
        title: <FormattedMessage id='storage_document.counterparty_type' />,
        dataIndex: 'counterpartBusinessSupplierId',
        key: 'counterpartBusinessSupplierId',
        width: 80,
        render: (_, document) => (
            <div>
                {document.counterpartBusinessSupplierId ? (
                    <FormattedMessage id='storage_document.supplier' />
                ) : document.counterpartClientId || document.clientId ? (
                    <FormattedMessage id='storage_document.client' />
                ) : document.counterpartEmployeeId ? (
                    <FormattedMessage id='storage_document.own_consumpty' />
                ) : document.counterpartWarehouseId && document.type == EXPENSE ? (
                    <FormattedMessage id='storage_document.inventory' />
                ) : (
                    <FormattedMessage id='long_dash' />
                )}
            </div>
        )
    };

    const sumCol = {
        title: <FormattedMessage id='purchase_sum' />,
        dataIndex: 'sum',
        key: 'sum',
        sorter: (a, b) => a.sum - b.sum,
        width: 60,
        render: (_, document) => (
            <Numeral
                // TODO
                currency={getCurrency()}
                mask='0,0.00'
                nullText='0'
            >
                {document.sum || document.totalsum}
            </Numeral>
        )
    };

    const sellingSumCol = {
        title: <FormattedMessage id='storage_document.selling_sum' />,
        dataIndex: 'sellingSum',
        key: 'sellingSum',
        sorter: (a, b) => a.sellingSum - b.sellingSum,
        width: 60,
        render: (_, document) => (
            <Numeral
                // TODO
                currency={getCurrency()}
                mask='0,0.00'
                nullText='0'
            >
                {document.sellingSum}
            </Numeral>
        )
    };

    const documentTypeCol = {
        title: <FormattedMessage id='storage_document.document_type' />,
        dataIndex: 'type',
        key: 'type',
        width: 80,
        render: (_, document) => {
            return (
                <div>
                    <FormattedMessage
                        id={`storage_document.docType.${isOrder ? ORDER : document.type}.${
                            isOrder && document.type == EXPENSE && document.documentType == SUPPLIER
                                ? ORDERINCOME
                                : document.documentType
                        }`}
                    />
                </div>
            );
        }
    };

    const commentCol = {
        title: <FormattedMessage id='comment' />,
        dataIndex: 'comment',
        key: 'comment',
        width: 80,
        render: (_, document) => (
            <div>
                {document.comment ? document.comment : <FormattedMessage id='long_dash' />}
            </div>
        )
    };

    const documentStatusCol = {
        title: <FormattedMessage id='storage_document.document_status' />,
        dataIndex: 'status',
        key: 'status',
        width: 80,
        render: (_, document) => (
            <div>
                {document.status == DONE ? (
                    <React.Fragment>
                        <FormattedMessage id='storage_document.status_confirmed' />{' '}
                        <CheckCircleFilled style={{ color: 'var(--green)' }} />
                    </React.Fragment>
                ) : (
                    <React.Fragment>
                        <FormattedMessage id='storage_document.status_created' />{' '}
                        <ClockCircleFilled style={{ color: 'var(--orange)' }} />
                    </React.Fragment>
                )}
            </div>
        )
    };

    const documentApiStatusCol = {
        title: <FormattedMessage id='storage_document.document_externalApiOrderStatus' />,
        dataIndex: 'externalApiOrderStatus',
        key: 'externalApiOrderStatus',
        width: 80,
        render: (_, document) => (
            <div>
                {document.externalApiOrderStatus == 'SENT' && (
                    <React.Fragment>
                        <FormattedMessage id='storage_document.externalApiOrderStatus_SENT' />{' '}
                        <ClockCircleFilled style={{ color: 'var(--orange)' }} />
                    </React.Fragment>
                )}
                {document.externalApiOrderStatus == 'RECEIVED' && (
                    <React.Fragment>
                        <FormattedMessage id='storage_document.externalApiOrderStatus_RECEIVED' />{' '}
                        <CheckCircleFilled style={{ color: 'var(--green)' }} />
                    </React.Fragment>
                )}
                {document.externalApiOrderStatus != 'SENT' &&
                    document.externalApiOrderStatus != 'RECEIVED' && (
                        <React.Fragment>
                            <FormattedMessage id='storage_document.externalApiOrderStatus_UNDEFINED' />{' '}
                            <QuestionCircleFilled />
                        </React.Fragment>
                    )}
            </div>
        )
    };

    const documentStorageExpensesCol = {
        title: <FormattedMessage id='storage_document.storage_expenses' />,
        dataIndex: 'expense',
        key: 'expense',
        width: 80,
        render: (_, document) => (
            <div>
                {isTransfer || isExpense ? (
                    document.warehouseName
                ) : (
                    <FormattedMessage id='long_dash' />
                )}
            </div>
        )
    };

    const documentStorageIncomeCol = {
        title: <FormattedMessage id='storage_document.storage_income' />,
        dataIndex: 'income',
        key: 'income',
        width: 80,
        render: (_, document) => (
            <div>
                {!isTransfer || isIncomes? (
                    document.warehouseName
                ) : (
                    document.counterpartWarehouseName
                )}
            </div>
        )
    };

    const deleteActionCol = {
        key: 'delete',
        width: 20,
        render: (_, document) =>
            !isCRUDForbidden && (
                <div>
                    <Popconfirm
                        onConfirm={() => {
                            const token = localStorage.getItem('_my.carbook.pro_token');
                            const url = `${__API_URL__}/store_docs/${document.id}`;
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
                                    window.location.reload();
                                })
                                .catch(function (error) {
                                    console.log('error', error);
                                });
                        }}
                        title={formatMessage({
                            id: 'add_order_form.delete_confirm'
                        })}
                        type='danger'
                    >
                        <DeleteOutlined
                            className={
                                document.status == DONE
                                    ? Styles.disabledDeleteDocumentIcon
                                    : Styles.deleteDocumentIcon
                            }
                        />
                    </Popconfirm>
                </div>
            )
    };

    switch (activeRoute) {
        case '/storage-orders':
            return [
                orderCol,
                datetimeCol,
                counterpartyCol,
                sumCol,
                documentTypeCol,
                documentStatusCol,
                documentApiStatusCol,
                deleteActionCol
            ];

        case '/storage-incomes':
            let columns = [
                orderCol,
                datetimeCol,
                invoiceNumberCol,
                counterpartyCol,
                counterpartyTypeCol,
                sumCol,
                documentTypeCol,
                documentStatusCol,
                // documentStorageExpensesCol,
                documentStorageIncomeCol,
                deleteActionCol
            ];
            console.log('document*******************',document)
            if (document.type === INC) {
                columns.splice(8, 0, commentCol);
                console.log('document.type***************',document.type)
            }
            return columns;

        case '/storage-expenses':
            return [
                orderCol,
                datetimeCol,
                counterpartyCol,
                counterpartyTypeCol,
                sumCol,
                sellingSumCol,
                documentTypeCol,
                documentStatusCol,
                documentStorageExpensesCol,
                // documentStorageIncomeCol,
                deleteActionCol
            ];
         
        case '/storage-orders-expenses':
            return [
                orderCol,
                datetimeCol,
                counterpartyCol,
                counterpartyTypeCol,
                sumCol,
                documentTypeCol,
                documentStatusCol,
                documentStorageExpensesCol,
                // documentStorageIncomeCol,
                deleteActionCol
            ];

        case '/storage-transfers':
            return [
                orderCol,
                datetimeCol,
                sumCol,
                documentStatusCol,
                documentStorageExpensesCol,
                documentStorageIncomeCol,
                deleteActionCol
            ];

        case '/supplier/:id':
            return [
                orderCol,
                datetimeCol,
                counterpartyCol,
                sumCol,
                documentTypeCol,
                documentStatusCol
            ];

        default:
            return [orderCol, datetimeCol, sumCol];
    }
}

export function rowsConfig(activeRoute, selectedRowKeys, onChange, getCheckboxProps) {
    if (activeRoute === '/orders/success' || activeRoute === '/orders/cancel') {
        return {
            selectedRowKeys,
            onChange,
            getCheckboxProps
        };
    }

    return null;
}

export function scrollConfig(activeRoute) {
    switch (activeRoute) {
        case '/orders/appointments':
            return { x: 1500, y: '50vh' }; // 1600 - 80 -
        case '/orders/approve':
            return { x: 1340, y: '50vh' };
        case '/orders/progress':
            return { x: 1340, y: '50vh' }; // 1440 - 80 - 20
        case '/orders/success':
            return { x: 1860, y: '50vh' }; // 1820
        case '/orders/reviews':
            return { x: 1520, y: '50vh' }; // 1620
        case '/orders/invitations':
            return { x: 1260, y: '50vh' }; // 1400
        case 'orders/cancel':
            return { x: 1400, y: '50vh' }; // 1640 // -160 second date
        default:
            return { x: 1540, y: '50vh' }; // 1640
    }
}
