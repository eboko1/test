import {
    CopyOutlined,
    DeleteOutlined,
    EditOutlined,
    MenuOutlined,
    PlusOutlined,
    PlusSquareOutlined,
    ShoppingOutlined,
    TransactionOutlined,
    WarningOutlined
} from '@ant-design/icons';
import { Button, Dropdown, InputNumber, Menu, Modal, Popconfirm, Tooltip, notification } from 'antd';
import { Barcode, DraggableTable } from 'components';
import * as constants from 'pages/Storage/constants';
import React from 'react';
import { FormattedMessage, injectIntl } from 'react-intl';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import book from 'routes/book';
import { fetchAPI, isForbidden, permissions } from 'utils';
import { MODALS, saveModal, setModal } from '../../../../../core/modals/duck';
import Styles from './styles.m.css';

const INCOME = 'INCOME';
const EXPENSE = 'EXPENSE';
const TRANSFER = 'TRANSFER';
const ORDERINCOME = 'ORDERINCOME';

const mapStateToProps = state => ({
    user: state.auth,
    modalProps: state.modals.modalProps
});

const mapDispatchToProps = {
    setModal,
    saveModal
};

@injectIntl
@connect(mapStateToProps, mapDispatchToProps)
class DocProductsTable extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            brandSearchValue: '',
            brands: [],
            detailOptions: [],
            selectedRowKeys: [],
            selectedRows: [],
            setPriceModalValue: 1,
            orderId: null
        };
        const actionColWidth = !this.props.disabled ? '3%' : '0';
        const prefix = 'MRD';
        this.columns = [
            {
                title: () =>
                    !this.props.disabled && (
                        <div className={Styles.headerActions}>
                            <Dropdown
                                overlay={
                                    <Menu>
                                        <Popconfirm
                                            disabled={!this.state.selectedRowKeys.length}
                                            onConfirm={async () => {
                                                const result = this.props.docProducts.filter(
                                                    ({ id }) =>
                                                        this.state.selectedRows.findIndex(row => row.id === id) < 0
                                                );
                                                this.props.updateFormData({ docProducts: result }, true);
                                                this.setState({
                                                    selectedRowKeys: [],
                                                    selectedRows: []
                                                });
                                            }}
                                            title={<FormattedMessage id='add_order_form.delete_confirm' />}
                                        >
                                            <Menu.Item disabled={!this.state.selectedRowKeys.length}>
                                                <DeleteOutlined
                                                    className={Styles.actionMenuIcon}
                                                    data-qa='doc_products_table.delete_menu_btn'
                                                />
                                                <FormattedMessage id='delete' />
                                            </Menu.Item>
                                        </Popconfirm>
                                        <Menu.Item
                                            disabled={!this.state.selectedRowKeys.length}
                                            onClick={() => {
                                                this.setState({ setPriceModal: true });
                                            }}
                                        >
                                            <div>
                                                <TransactionOutlined
                                                    className={Styles.actionMenuIcon}
                                                    data-qa='doc_products_table.update_price_menu_btn'
                                                />
                                                <FormattedMessage id='update_price' />
                                            </div>
                                        </Menu.Item>

                                        {(this.props.documentType === constants.SUPPLIER ||
                                            this.props.type === constants.ORDER) &&
                                            this.props.type !== constants.EXPENSE && (
                                                <Menu.Item
                                                    disabled={!this.state.selectedRowKeys.length}
                                                    onClick={() => {
                                                        this.props.addPartsToOrder(this.state.selectedRowKeys);
                                                    }}
                                                >
                                                    <div>
                                                        <PlusSquareOutlined className={Styles.actionMenuIcon} />
                                                        <FormattedMessage id='storage_document.create_order' />
                                                    </div>
                                                </Menu.Item>
                                            )}

                                        {(this.props.documentType === constants.SUPPLIER ||
                                            this.props.type === constants.ORDER) &&
                                            this.props.type !== constants.EXPENSE && (
                                                <Menu.Item
                                                    disabled={!this.state.selectedRowKeys.length}
                                                    onClick={() => {
                                                        this.props.saveModal();
                                                        this.props.setModal(MODALS.SELECT_ORDER, {
                                                            onClick: value => {
                                                            //     this.setState({
                                                            //         orderId: value
                                                            //     });
                                                            }
                                                        });
                                                    }}
                                                    //value={this.props.orderId}
                                                >
                                                    <div>
                                                        <ShoppingOutlined className={Styles.actionMenuIcon} />
                                                        <FormattedMessage id='storage_document.select_order' />
                                                    </div>
                                                </Menu.Item>
                                            )}
                                    </Menu>
                                }
                            >
                                <Button
                                    data-qa='doc_products_table.menu_btn'
                                    disabled={isForbidden(this.props.user, permissions.ACCESS_STOCK)}
                                    icon={<MenuOutlined />}
                                />
                            </Dropdown>
                            <Tooltip title={<FormattedMessage id='add' />}>
                                <Button
                                    data-qa='doc_products_table.add_btn'
                                    disabled={isForbidden(this.props.user, permissions.ACCESS_STOCK)}
                                    icon={<PlusOutlined />}
                                    onClick={() => {
                                        if (!isForbidden(this.props.user, permissions.ACCESS_STOCK)) {
                                            this.props.showModal();
                                        }
                                    }}
                                />
                            </Tooltip>
                            <Barcode
                                button
                                buttonStyle={{
                                    padding: '0px 8px'
                                }}
                                data-qa='doc_products_table.barcode_btn'
                                // disabled={
                                //     this.props.disabled ||
                                //     isForbidden(this.props.user, permissions.ACCESS_STOCK)
                                // }
                                multipleMode
                                onCancel={this.props.barcodeFinish}
                                onConfirm={(barcode, pefix, fullCode) => {
                                    this.props.addByBarcode(barcode);
                                }}
                                prefix='STP'
                            />
                        </div>
                    ),
                width: actionColWidth,
                key: 'edit',
                align: 'center',
                render: row => {
                    const accessForbidden = isForbidden(this.props.user, permissions.ACCESS_STOCK);

                    return this.props.disabled ? null : (
                        <div className={Styles.rowActions}>
                            {row.productId ? (
                                <Tooltip title={<FormattedMessage id='edit' />}>
                                    <Button
                                        data-qa='doc_products_table.edit_btn'
                                        disabled={this.props.disabled || accessForbidden}
                                        icon={<EditOutlined />}
                                        onClick={() => {
                                            if (!accessForbidden) {
                                                this.props.editProduct(row.key);
                                            }
                                        }}
                                    />
                                </Tooltip>
                            ) : (
                                <Button
                                    data-qa='doc_products_table.warning_btn'
                                    disabled={this.props.disabled || accessForbidden}
                                    icon={<WarningOutlined />}
                                    onClick={() => {
                                        if (!accessForbidden) {
                                            this.props.editProduct(row.key, true);
                                        }
                                    }}
                                    style={{
                                        backgroundColor: 'var(--approve)'
                                    }}
                                    type='primary'
                                />
                            )}
                            <Popconfirm
                                onConfirm={async () => {
                                    await this.props.deleteDocProduct(row);
                                    this.setState({});
                                }}
                                title={<FormattedMessage id='add_order_form.delete_confirm' />}
                            >
                                <Tooltip title={<FormattedMessage id='delete' />}>
                                    <Button
                                        data-qa='doc_products_table.delete_btn'
                                        disabled={
                                            this.props.disabled ||
                                            !row.detailCode ||
                                            isForbidden(this.props.user, permissions.ACCESS_STOCK)
                                        }
                                        icon={<DeleteOutlined />}
                                    />
                                </Tooltip>
                            </Popconfirm>
                            {(this.props.documentType === constants.SUPPLIER || this.props.type === constants.ORDER) &&
                                this.props.type !== constants.EXPENSE &&
                                !['ORD', 'BOR'].includes(this.props.operationCode) && (
                                    <Tooltip title={<FormattedMessage id='storage_document.create_order' />}>
                                        <Button
                                            disabled={this.props.disabled || !row.orderId}
                                            icon={<PlusSquareOutlined />}
                                            onClick={() => {
                                                this.props.addPartsToOrder([row.id]);
                                            }}
                                        />
                                    </Tooltip>
                                )}
                        </div>
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.brand' />,
                key: 'brandName',
                dataIndex: 'brandName',
                render: data => {
                    return data || <FormattedMessage id='long_dash' />;
                }
            },
            {
                title: <FormattedMessage id='order_form_table.detail_code' />,
                key: 'detailCode',
                dataIndex: 'detailCode',
                render: (data, elem) => {
                    return data ? (
                        <div
                            style={{
                                display: 'flex'
                            }}
                        >
                            <Link to={`${book.product}/${elem.productId}`}>
                                <div
                                    style={{
                                        fontWeight: 500,
                                        textDecoration: 'underline'
                                    }}
                                >
                                    {data}
                                </div>
                            </Link>
                            <div>
                                <Tooltip title={<FormattedMessage id='vehicle_page.hint_copy_to_clipboard' />}>
                                    <CopyOutlined
                                        onClick={() => {
                                            navigator.clipboard.writeText(data);
                                            notification.success({
                                                message: this.props.intl.formatMessage({
                                                    id: 'barcode.success'
                                                })
                                            });
                                        }}
                                        style={{ marginLeft: 2, cursor: 'pointer' }}
                                    />
                                </Tooltip>
                            </div>
                        </div>
                    ) : (
                        <FormattedMessage id='long_dash' />
                    );
                }
            },
            // {
            //     title: <FormattedMessage id='directories.orders' />,
            //     key: 'source',
            //     dataIndex: 'orderId',
            //     render: data => {
            //         return data || <FormattedMessage id='long_dash' />;
            //     }
            // },
            {
                title: <FormattedMessage id='storage.trade_code' />,
                key: 'uktz',
                dataIndex: 'uktz',
                render: data => {
                    return data || <FormattedMessage id='long_dash' />;
                }
            },
            {
                title: (
                    <span>
                        <FormattedMessage id='order_form_table.detail_code' /> (
                        <FormattedMessage id='storage.supplier' />)
                    </span>
                )
                // key: 'tradeCode',
                // dataIndex: 'tradeCode',
                // render: data => {
                //     return data || <FormattedMessage id='long_dash' />;
                // }
            },
            {
                title: <FormattedMessage id='order' />,
                key: 'order',
                render: row => {
                    return (
                        <div>
                            <div
                                style={{
                                    fontWeight: 700,
                                    textDecoration: row.detailCode && 'underline'
                                }}
                            >
                                <Link to={`${book.order}/${row.orderId || this.props.orderId}`}>
                                    {row.orderNum ||
                                        this.props.orderNum ||
                                        `${
                                            row.orderId || this.props.orderId
                                                ? `${prefix}-${this.props.user.businessId}-`
                                                : ''
                                        }${row.orderId || this.props.orderId || ''}`}
                                </Link>
                            </div>
                        </div>
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.detail_name' />,
                key: 'detailName',
                dataIndex: 'detailName',
                render: data => {
                    return data || <FormattedMessage id='long_dash' />;
                }
            },

            {
                title: <FormattedMessage id='order_form_table.purchasePrice' />,
                key: 'stockPrice',
                dataIndex: 'stockPrice',
                align: 'right',
                render: data => {
                    return (
                        <div>
                            {data ? (
                                `${Number(data).toFixed(2)}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
                            ) : (
                                <FormattedMessage id='long_dash' />
                            )}
                        </div>
                    );
                }
            },
            {
                title: <FormattedMessage id='storage_document.sell_price' />,
                key: 'sellingPrice',
                align: 'right',
                render: row => {
                    const price = row.sellingPrice;
                    const strVal = Number(price).toFixed(2);

                    return (
                        <div>
                            {price ? (
                                `${strVal}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
                            ) : (
                                <FormattedMessage id='long_dash' />
                            )}
                        </div>
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.count' />,
                key: 'quantity',
                dataIndex: 'quantity',
                align: 'right',
                render: data => {
                    return <div>{data ? Math.abs(Number(data)).toFixed(2) : <FormattedMessage id='long_dash' />}</div>;
                }
            },
            {
                title: <FormattedMessage id='services_table.units' />,
                key: 'units',
                dataIndex: 'measureUnit',
                render: data => {
                    return data || <FormattedMessage id='long_dash' />;
                }
            },
            {
                title: <FormattedMessage id='purchase_sum' />,
                key: 'stockSum',
                align: 'right',
                render: row => {
                    const strVal = Math.abs(Number(row.stockPrice || 0) * Number(row.quantity || 0)).toFixed(2);

                    return (
                        <div>
                            {strVal ? (
                                `${strVal}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
                            ) : (
                                <FormattedMessage id='long_dash' />
                            )}
                        </div>
                    );
                }
            },
            {
                title: <FormattedMessage id='storage_gocument.sell_sum' />,
                key: 'sellingSum',
                align: 'right',
                render: row => {
                    const strVal = Math.abs(Number(row.sellingPrice || 0) * Number(row.quantity || 0)).toFixed(2);

                    return (
                        <div>
                            {strVal ? (
                                `${strVal}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
                            ) : (
                                <FormattedMessage id='long_dash' />
                            )}
                        </div>
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.status' />,
                key: 'status',
                dataIndex: 'status',
                align: 'center',
                render: data => {
                    let statusColor = '';
                    switch (data) {
                        case 'ENTER_DATA':
                            statusColor = 'var(--db-comment)';
                            break;
                        case 'NO_GOODS':
                            statusColor = 'var(--db_invite)';
                            break;
                        case 'IN_RESERVE':
                            statusColor = 'var(--warning)';
                            break;
                        case 'READY':
                            statusColor = 'var(--green)';
                            break;
                        case 'OK':
                            statusColor = 'var(--db_success)';
                            break;
                        default:
                            statusColor = 'var(--lightGray)';
                    }

                    return data ? (
                        <div
                            data-qa='doc_products_table.status_btn'
                            style={{
                                border: `2px solid ${statusColor}`,
                                padding: '6px 2px',
                                textAlign: 'center',
                                fontWeight: 500,
                                // textTransform: 'uppercase',
                                // border: '1px solid black',
                                cursor: 'pointer'
                            }}
                            title={this.props.intl.formatMessage({
                                id: `status.doc.${data}.title`
                            })}
                        >
                            <FormattedMessage id={`status.doc.${data}`} />
                        </div>
                    ) : null;
                }
            }
        ];

        this.fromCellColumn = {
            title: <FormattedMessage id='wms.from_cell' />,
            key: 'getFromAddress',
            dataIndex: 'getFromAddress',
            render: data => {
                return data || <FormattedMessage id='long_dash' />;
            }
        };

        this.cellColumn = {
            title: <FormattedMessage id='wms.cell' />,
            key: 'addToAddress',
            dataIndex: 'addToAddress',
            render: data => {
                return data || <FormattedMessage id='long_dash' />;
            }
        };
    }

    render() {
        const { docProducts, loading, type, documentType, updateFormData, disabled } = this.props;
        const { selectedRowKeys, setPriceModal, setPriceModalValue } = this.state;

        const tblColumns = [...this.columns];
        if (type === INCOME || documentType === ORDERINCOME || type === TRANSFER) {
            tblColumns.splice(5, 0, this.cellColumn);
        }
        if (type === EXPENSE || type === TRANSFER) {
            tblColumns.splice(5, 0, this.fromCellColumn);
        }
        if (disabled) {
            tblColumns.splice(0, 1);
        }

        const rowSelection = {
            selectedRowKeys,
            onChange: (selectedRowKeys, selectedRows) => {
                this.setState({
                    selectedRowKeys,
                    selectedRows
                });
            },
            getCheckboxProps: record => ({
                disabled: !record.id
            })
        };

        return (
            <React.Fragment>
                <DraggableTable
                    addDragColumn
                    bordered
                    columns={tblColumns}
                    dataSource={docProducts}
                    loading={loading}
                    onDragEnd={async (fromIndex, toIndex) => {
                        await fetchAPI(
                            'PUT',
                            'store_docs/swap_products',
                            null,
                            {
                                id: this.props.id,
                                order1: docProducts[fromIndex].order,
                                order2: docProducts[toIndex].order
                            },
                            { handleErrorInternally: true }
                        );
                        this.props.fetchStorageDocument();
                    }}
                    pagination={false}
                    rowClassName={Styles.detailsTableRow}
                    rowKey='id'
                    rowSelection={!disabled && rowSelection}
                    size='small'
                />
                <Modal
                    destroyOnClose
                    onCancel={() => {
                        this.setState({
                            setPriceModal: undefined,
                            setPriceModalValue: 1
                        });
                    }}
                    onOk={() => {
                        docProducts.forEach(prd => {
                            if (selectedRowKeys.includes(prd.key)) {
                                if (prd.sellingPrice) {
                                    prd.sellingPrice *= setPriceModalValue;
                                }
                                if (prd.stockPrice) {
                                    prd.stockPrice *= setPriceModalValue;
                                }
                            }
                        });
                        updateFormData({ docProducts }, true);
                        this.setState({
                            selectedRowKeys: [],
                            selectedRows: [],
                            setPriceModal: undefined,
                            setPriceModalValue: 1
                        });
                    }}
                    title={<FormattedMessage id='update_price' />}
                    visible={setPriceModal}
                >
                    <FormattedMessage id='factor' />
                    <InputNumber
                        data-qa='doc_products_table.factor'
                        decimalSeparator=','
                        onChange={value => {
                            this.setState({
                                setPriceModalValue: value
                            });
                        }}
                        precision={4}
                        step={0.002}
                        style={{ margin: '0 0 0 8px' }}
                        value={setPriceModalValue}
                    />
                </Modal>
            </React.Fragment>
        );
    }
}

export default DocProductsTable;
