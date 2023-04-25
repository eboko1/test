/* eslint-disable no-sparse-arrays */
import {
    ArrowLeftOutlined,
    ArrowRightOutlined,
    BlockOutlined,
    CheckCircleOutlined,
    CheckOutlined,
    CloseCircleOutlined,
    CopyOutlined,
    DeleteOutlined,
    EditOutlined,
    FilterFilled,
    FilterOutlined,
    ForkOutlined,
    LockOutlined,
    MenuOutlined,
    PlusOutlined,
    QuestionCircleOutlined,
    RedoOutlined,
    SearchOutlined,
    ShoppingOutlined,
    SortAscendingOutlined,
    UndoOutlined,
    UnlockOutlined,
    UnorderedListOutlined,
    WarningOutlined
} from '@ant-design/icons';
import {
    Button,
    Dropdown,
    Input,
    Menu,
    Modal,
    notification,
    Popconfirm,
    Popover,
    Radio,
    Select,
    Table,
    Tabs,
    Tooltip
} from 'antd';
import { Catcher, Layout } from 'commons';
import { AvailabilityIndicator, DateRangePicker, HamburgerMenu, ReserveButton } from 'components';
import { fetchBrands, selectBrands } from 'core/brands/duck';
import { MODALS, resetModal, setModal } from 'core/modals/duck';
import { fetchSuppliers } from 'core/suppliers/duck';
import { fetchWarehouses } from 'core/warehouses/duck';
import dayjs from 'dayjs';
import _ from 'lodash';
import {
    AddRowsReturnSurplusesModal,
    DetailStorageModal,
    DetailSupplierModal,
    DetailWarehousesCountModal,
    OrderDetailModal,
    PriceRecalculationModal,
    StoreProductModal,
    StoreProductTrackingModal,
    VinCodeModal
} from 'modals';
import React, { Component } from 'react';
import { FormattedMessage, injectIntl } from 'react-intl';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import book from 'routes/book';
import { GridIcon, PriceTagIcon } from 'theme';
import { buildStoreGroupsTree, fetchAPI, isForbidden, permissions, showDetailsActionNotification } from 'utils';
import { v4 } from 'uuid';
import SuppliersIncomeModal from '../../forms/OrderForm/OrderFormTables/DetailsTable/modals/SuppliersIncomeModal';
import {
    changeOrdersSurplusesDataFilters,
    changeSparePartsWorkplaceDataFilters,
    changeSparePartsWorkplaceTab,
    fetchSparePartsWorkplaceData,
    returnDetailsToSupplier,
    selectOrdersToStorageData,
    selectSparePartsWorkplaceData,
    selectSparePartsWorkplaceFilters,
    updateOrdersForSurpluses,
    updateSparePartsWorkplaceData
} from './redux/duck';
import Styles from './styles.m.css';


const { confirm } = Modal;
const { Option } = Select;
const { TabPane } = Tabs;
const { SubMenu } = Menu;
const mapStateToProps = state => ({
    sparePartsData: selectSparePartsWorkplaceData(state),
    ordersToStorageData: selectOrdersToStorageData(state),
    filters: selectSparePartsWorkplaceFilters(state),

    brands: selectBrands(state),
    warehouses: state.warehouses.warehouses,
    suppliers: state.suppliers.suppliers,

    user: state.auth,
    modal: state.modals.modal
});

const mapDispatchToProps = {
    fetchSparePartsWorkplaceData,
    updateSparePartsWorkplaceData,
    updateOrdersForSurpluses,
    changeSparePartsWorkplaceDataFilters,
    changeOrdersSurplusesDataFilters,
    returnDetailsToSupplier,
    changeSparePartsWorkplaceTab,

    fetchBrands,
    fetchWarehouses,
    fetchSuppliers,

    setModal,
    resetModal
};

@connect(mapStateToProps, mapDispatchToProps)
@injectIntl
export default class SparePartsWorkplacePage extends Component {
    constructor(props) {
        super(props);

        this.state = {
            selectedRowKeys: [],
            selectedRows: [],
            searchText: '',
            searchedColumn: '',
            loading: true,
            detailsTreeData: [],
            allDetails: [],
            statuses: [],
            activeKey: 'fromOrders',
            displayType: 'list'
        };

        this.columns = () => [
            {
                title: () => {
                    const { warehouses } = this.props;

                    const { fetchSparePartsWorkplaceData, updateSparePartsWorkplaceData, updateOrdersForSurpluses } =
                        this;

                    const { selectedRowKeys, selectedRows, activeKey } = this.state;
                    const actionsMenu = () => (
                        <Menu className={Styles.actionMenuDropdown}>
                            <Menu.Item disabled={!selectedRowKeys.length}>
                                <div
                                    onClick={async () => {
                                        if (activeKey === 'returnSurpluses') {
                                            await fetchAPI(
                                                'PUT',
                                                'orders/details',
                                                undefined,
                                                {
                                                    details: selectedRows.map(({ id }) => ({
                                                        id,
                                                        isCriticalByTime: true
                                                    }))
                                                },
                                                { handleErrorInternally: true }
                                            );
                                            this.getOrdersForSurpluses();
                                        } else {
                                            updateSparePartsWorkplaceData(
                                                selectedRows.map(({ id }) => ({
                                                    id,
                                                    isCriticalByTime: true
                                                }))
                                            );
                                        }
                                    }}
                                >
                                    <WarningOutlined className={Styles.actionMenuIcon} />
                                    <FormattedMessage id='profile.spare_parts_workplace.critical' />
                                </div>
                            </Menu.Item>
                            <SubMenu
                                disabled={!selectedRowKeys.length}
                                title={
                                    <React.Fragment>
                                        <EditOutlined className={Styles.actionMenuIcon} style={{ fontSize: 18 }} />
                                        <FormattedMessage id='profile.spare_parts_workplace.change_status' />
                                    </React.Fragment>
                                }
                            >
                                {this.state.statuses.map(({ status }) => (
                                    <Menu.Item
                                        key={status}
                                        onClick={async () => {
                                            if (activeKey === 'returnSurpluses') {
                                                await fetchAPI(
                                                    'PUT',
                                                    'orders/details',
                                                    undefined,
                                                    {
                                                        details: selectedRows.map(({ id }) => ({
                                                            id,
                                                            status
                                                        }))
                                                    },
                                                    { handleErrorInternally: true }
                                                );
                                                this.getOrdersForSurpluses();
                                            } else {
                                                updateSparePartsWorkplaceData(
                                                    selectedRows.map(({ id }) => ({
                                                        id,
                                                        status
                                                    }))
                                                );
                                            }
                                        }}
                                    >
                                        <FormattedMessage id={`status.${status}`} />
                                    </Menu.Item>
                                ))}
                            </SubMenu>
                            <SubMenu
                                disabled={!selectedRowKeys.length}
                                title={
                                    <React.Fragment>
                                        <QuestionCircleOutlined
                                            className={Styles.actionMenuIcon}
                                            style={{ fontSize: 18 }}
                                        />
                                        <FormattedMessage id='order_form_table.PD' />
                                    </React.Fragment>
                                }
                            >
                                <Menu.Item
                                    key='undefined'
                                    onClick={async () => {
                                        // if (activeKey === 'storageOrders') {
                                        //     updateSparePartsWorkplaceData(
                                        //         selectedRows.map(({ id }) => ({
                                        //             id,
                                        //             agreement: 'UNDEFINED'
                                        //         }))
                                        //     );
                                        // } else 
                                        if (activeKey === 'returnSurpluses') {
                                            await fetchAPI(
                                                'PUT',
                                                'orders/details',
                                                undefined,
                                                {
                                                    details: selectedRows.map(({ id }) => ({
                                                        id,
                                                        agreement: 'UNDEFINED'
                                                    }))
                                                },
                                                { handleErrorInternally: true }
                                            );
                                            this.getOrdersForSurpluses();
                                        } else {
                                            updateSparePartsWorkplaceData(
                                                selectedRows.map(({ id }) => ({
                                                    id,
                                                    agreement: 'UNDEFINED'
                                                }))
                                            );
                                        }
                                    }}
                                >
                                    <QuestionCircleOutlined
                                        style={{
                                            fontSize: 18,
                                            verticalAlign: 'sub',
                                            marginRight: 8
                                        }}
                                    />
                                    <FormattedMessage id='agreement.undefined' />
                                </Menu.Item>
                                <Menu.Item
                                    key='agreed'
                                    onClick={async () => {
                                        if (activeKey === 'returnSurpluses') {
                                            await fetchAPI(
                                                'PUT',
                                                'orders/details',
                                                undefined,
                                                {
                                                    details: selectedRows.map(({ id }) => ({
                                                        id,
                                                        agreement: 'AGREED'
                                                    }))
                                                },
                                                { handleErrorInternally: true }
                                            );
                                            this.getOrdersForSurpluses();
                                        } else {
                                            updateSparePartsWorkplaceData(
                                                selectedRows.map(({ id }) => ({
                                                    id,
                                                    agreement: 'AGREED'
                                                }))
                                            );
                                        }
                                    }}
                                    style={{ color: 'var(--green)' }}
                                >
                                    <CheckCircleOutlined
                                        style={{
                                            fontSize: 18,
                                            verticalAlign: 'sub',
                                            marginRight: 8,
                                            color: 'var(--green)'
                                        }}
                                    />
                                    <FormattedMessage id='agreement.agreed' />
                                </Menu.Item>
                                <Menu.Item
                                    key='rejected'
                                    onClick={async () => {
                                        if (activeKey === 'returnSurpluses') {
                                            await fetchAPI(
                                                'PUT',
                                                'orders/details',
                                                undefined,
                                                {
                                                    details: selectedRows.map(({ id }) => ({
                                                        id,
                                                        agreement: 'REJECTED'
                                                    }))
                                                },
                                                { handleErrorInternally: true }
                                            );
                                            this.getOrdersForSurpluses();
                                        } else {
                                            updateSparePartsWorkplaceData(
                                                selectedRows.map(({ id }) => ({
                                                    id,
                                                    agreement: 'REJECTED'
                                                }))
                                            );
                                        }
                                    }}
                                    style={{ color: 'rgb(255, 126, 126)' }}
                                >
                                    <CloseCircleOutlined
                                        style={{
                                            fontSize: 18,
                                            marginRight: 8
                                        }}
                                    />
                                    <FormattedMessage id='agreement.rejected' />
                                </Menu.Item>
                            </SubMenu>
                            <Menu.Item disabled={!selectedRowKeys.length}>
                                <Popconfirm
                                    disabled={!selectedRowKeys.length}
                                    onConfirm={async () => {
                                        const response = await fetchAPI(
                                            'PUT',
                                            'orders/details',
                                            undefined,
                                            {
                                                details: selectedRows.map(({ id }) => ({ id }))
                                            },
                                            { handleErrorInternally: true }
                                        );
                                        await showDetailsActionNotification(
                                            this.props.intl,
                                            'update_stage',
                                            response.all,
                                            response.success
                                        );
                                        if (activeKey === 'returnSurpluses') {
                                            this.getOrdersForSurpluses();
                                        } else {
                                            fetchSparePartsWorkplaceData();
                                        }
                                    }}
                                    title={<FormattedMessage id='orders.update_stage' />}
                                >
                                    <div>
                                        <RedoOutlined className={Styles.actionMenuIcon} />
                                        <FormattedMessage id='orders.update_stage' />
                                    </div>
                                </Popconfirm>
                            </Menu.Item>
                            <Menu.Item
                                key='groupDetailsMenu.changeGroup'
                                disabled
                                onClick={async () => {
                                    const groupName = v4();
                                    if (activeKey === 'returnSurpluses') {
                                        await fetchAPI(
                                            'PUT',
                                            'orders/details',
                                            undefined,
                                            {
                                                details: selectedRows.map(({ id, agreement }, index) => ({
                                                    id,
                                                    groupName,
                                                    agreement: index >= 1 ? 'REJECTED' : agreement
                                                }))
                                            },
                                            { handleErrorInternally: true }
                                        );
                                        this.getOrdersForSurpluses();
                                    } else {
                                        updateSparePartsWorkplaceData(
                                            selectedRows.map(({ id, agreement }, index) => ({
                                                id,
                                                groupName,
                                                agreement: index >= 1 ? 'REJECTED' : agreement
                                            }))
                                        );
                                    }
                                }}
                            >
                                <div>
                                    <BlockOutlined className={Styles.actionMenuIcon} />
                                    <FormattedMessage id='orders.to_group' />
                                </div>
                            </Menu.Item>
                            <Menu.Item disabled={!selectedRowKeys.length}>
                                <div
                                    onClick={async () => {
                                        const payload = {
                                            details: [
                                                ...this.state.selectedRows.map(row => ({
                                                    storeGroupId: row.storeGroupId,
                                                    name: row.detailName,
                                                    productCode: row.detailCode,
                                                    supplierId: row.supplierId,
                                                    supplierBrandId: row.supplierBrandId,
                                                    purchasePrice: row.purchasePrice,
                                                    count: row.count,
                                                    price: row.price,
                                                    putAfterId: row.id,
                                                    orderId: row.orderId
                                                }))
                                            ]
                                        };
                                        const response = await fetchAPI('POST', 'orders/details', undefined, data);
                                        // await showDetailsActionNotification(this.props.intl, 'copy', response.all, response.success)
                                        if (activeKey === 'returnSurpluses') {
                                            this.getOrdersForSurpluses();
                                        } else {
                                            fetchSparePartsWorkplaceData();
                                        }
                                    }}
                                >
                                    <CopyOutlined className={Styles.actionMenuIcon} />
                                    <FormattedMessage id='profile.spare_parts_workplace.copy' />
                                </div>
                            </Menu.Item>
                            <Menu.Item disabled={!selectedRowKeys.length}>
                                <div onClick={() => this.setState({ setSupplierModalVisible: true })}>
                                    <PlusOutlined className={Styles.actionMenuIcon} />
                                    <FormattedMessage id='profile.spare_parts_workplace.set_supplier' />
                                </div>
                            </Menu.Item>
                            <Menu.Item disabled={!selectedRowKeys.length}>
                                <div
                                    onClick={() => {
                                        this.setState({
                                            priceRecalculationModalSelectedRow: true
                                        });
                                    }}
                                >
                                    <PriceTagIcon className={Styles.actionMenuIcon} />
                                    <FormattedMessage id='profile.spare_parts_workplace.check' />
                                </div>
                            </Menu.Item>
                            <Menu.Item disabled={!selectedRowKeys.length || activeKey === 'returnSurpluses'}>
                                <Popconfirm
                                    disabled={!selectedRowKeys.length || activeKey === 'returnSurpluses'}
                                    onConfirm={async () => {
                                        const response = await fetchAPI(
                                            'POST',
                                            'store_docs/order_all_possible',
                                            undefined,
                                            {
                                                ordersAppurtenanciesIds: selectedRows
                                                    .filter(row => row.agreement == 'AGREED')
                                                    .map(({ id }) => id)
                                            },
                                            { handleErrorInternally: true }
                                        );
                                        await showDetailsActionNotification(
                                            this.props.intl,
                                            'to_order',
                                            response.all,
                                            response.success
                                        );

                                        fetchSparePartsWorkplaceData();
                                    }}
                                    title={
                                        <React.Fragment>
                                            <FormattedMessage id='profile.spare_parts_workplace.to_order' />?
                                        </React.Fragment>
                                    }
                                >
                                    <div>
                                        <ShoppingOutlined className={Styles.actionMenuIcon} />
                                        <FormattedMessage id='profile.spare_parts_workplace.to_order' />
                                    </div>
                                </Popconfirm>
                            </Menu.Item>
                            <Menu.Item
                                disabled={!selectedRowKeys.length}
                                onClick={async () => {
                                    if (selectedRowKeys.length) {
                                        await this.setState({
                                            visibleSuppliersIncomeModal: true
                                        });
                                    }
                                }}
                                title={
                                    <React.Fragment>
                                        <FormattedMessage id='profile.spare_parts_workplace.accept' />?
                                    </React.Fragment>
                                }
                            >
                                <div>
                                    <CheckOutlined className={Styles.actionMenuIcon} />
                                    <FormattedMessage id='profile.spare_parts_workplace.accept' />
                                </div>
                            </Menu.Item>
                            <Menu.Item disabled={!selectedRowKeys.length}>
                                <Popconfirm
                                    disabled={!selectedRowKeys.length}
                                    onConfirm={async () => {
                                        const response = await fetchAPI(
                                            'POST',
                                            'store_docs/return_to_supplier_all_possible',
                                            undefined,
                                            {
                                                ordersAppurtenanciesIds: selectedRows.map(({ id }) => id)
                                            },
                                            { handleErrorInternally: true }
                                        );
                                        await showDetailsActionNotification(
                                            this.props.intl,
                                            'return_to_supplier',
                                            response.all,
                                            response.success
                                        );
                                        if (activeKey === 'returnSurpluses') {
                                            this.getOrdersForSurpluses();
                                        } else {
                                            fetchSparePartsWorkplaceData();
                                        }
                                    }}
                                    title={
                                        <React.Fragment>
                                            <FormattedMessage id='profile.spare_parts_workplace.return_to_supplier' />?
                                        </React.Fragment>
                                    }
                                >
                                    <div>
                                        <UndoOutlined className={Styles.actionMenuIcon} />
                                        <FormattedMessage id='profile.spare_parts_workplace.return_to_supplier' />
                                    </div>
                                </Popconfirm>
                            </Menu.Item>
                            <Menu.Item disabled={!selectedRowKeys.length || activeKey === 'returnSurpluses'}>
                                <div
                                    onClick={async () => {
                                        const response = await fetchAPI(
                                            'POST',
                                            'store_docs/reserve_all_possible',
                                            undefined,
                                            {
                                                ordersAppurtenanciesIds: selectedRows.map(({ id }) => id)
                                            },
                                            { handleErrorInternally: true }
                                        );
                                        await showDetailsActionNotification(
                                            this.props.intl,
                                            'reserved',
                                            response.all,
                                            response.success
                                        );
                                        if (activeKey === 'returnSurpluses') {
                                            this.getOrdersForSurpluses();
                                        } else {
                                            fetchSparePartsWorkplaceData();
                                        }
                                    }}
                                >
                                    <LockOutlined className={Styles.actionMenuIcon} />
                                    <FormattedMessage id='reserve' />
                                </div>
                            </Menu.Item>
                            <Menu.Item disabled={!selectedRowKeys.length || activeKey === 'returnSurpluses'}>
                                <div
                                    onClick={async () => {
                                        const response = await fetchAPI(
                                            'POST',
                                            'store_docs/unreserve_all_possible',
                                            undefined,
                                            {
                                                ordersAppurtenanciesIds: selectedRows.map(({ id }) => id)
                                            },
                                            { handleErrorInternally: true }
                                        );
                                        await showDetailsActionNotification(
                                            this.props.intl,
                                            'unreserved',
                                            response.all,
                                            response.success
                                        );
                                        if (activeKey === 'returnSurpluses') {
                                            this.getOrdersForSurpluses();
                                        } else {
                                            fetchSparePartsWorkplaceData();
                                        }
                                    }}
                                >
                                    <UnlockOutlined className={Styles.actionMenuIcon} />
                                    <FormattedMessage id='unreserve' />
                                </div>
                            </Menu.Item>
                            <Menu.Item disabled={!selectedRowKeys.length || activeKey === 'returnSurpluses'}>
                                <Popconfirm
                                    disabled={!selectedRowKeys.length || activeKey === 'returnSurpluses'}
                                    onConfirm={async () => {
                                        const response = await fetchAPI(
                                            'POST',
                                            'store_docs/transfer_reserved_all_possible',
                                            undefined,
                                            {
                                                ordersAppurtenanciesIds: selectedRows.map(({ id }) => id),
                                                toWarehouseId: warehouses.find(
                                                    ({ attribute }) => attribute == 'REPAIR_AREA'
                                                ).id
                                            },
                                            { handleErrorInternally: true }
                                        );
                                        await showDetailsActionNotification(
                                            this.props.intl,
                                            'transfer_to_repair',
                                            response.all,
                                            response.success
                                        );
                                        if (activeKey === 'returnSurpluses') {
                                            this.getOrdersForSurpluses();
                                        } else {
                                            fetchSparePartsWorkplaceData();
                                        }
                                    }}
                                    title={
                                        <React.Fragment>
                                            <FormattedMessage id='profile.spare_parts_workplace.give' />?
                                        </React.Fragment>
                                    }
                                >
                                    <div>
                                        <ArrowRightOutlined className={Styles.actionMenuIcon} />
                                        <FormattedMessage id='profile.spare_parts_workplace.give' />
                                    </div>
                                </Popconfirm>
                            </Menu.Item>
                            <Menu.Item disabled={!selectedRowKeys.length || activeKey === 'returnSurpluses'}>
                                <Popconfirm
                                    disabled={!selectedRowKeys.length || activeKey === 'returnSurpluses'}
                                    onConfirm={async () => {
                                        // returnDetailsToSupplier(selectedRows.map(({id})=>id));
                                        const response = await fetchAPI(
                                            'POST',
                                            'store_docs/transfer_reserved_all_possible',
                                            undefined,
                                            {
                                                ordersAppurtenanciesIds: selectedRows.map(({ id }) => id),
                                                toWarehouseId: warehouses.find(({ attribute }) => attribute == 'MAIN')
                                                    .id
                                            },
                                            { handleErrorInternally: true }
                                        );
                                        await showDetailsActionNotification(
                                            this.props.intl,
                                            'transfer_to_stock',
                                            response.all,
                                            response.success
                                        );
                                        if (activeKey === 'returnSurpluses') {
                                            this.getOrdersForSurpluses();
                                        } else {
                                            fetchSparePartsWorkplaceData();
                                        }
                                    }}
                                    title={
                                        <React.Fragment>
                                            <FormattedMessage id='profile.spare_parts_workplace.return_to_stock' />?
                                        </React.Fragment>
                                    }
                                >
                                    <div>
                                        <ArrowLeftOutlined className={Styles.actionMenuIcon} />
                                        <FormattedMessage id='profile.spare_parts_workplace.return_to_stock' />
                                    </div>
                                </Popconfirm>
                            </Menu.Item>
                            {activeKey !== 'fromOrders' && (
                                <Menu.Item disabled={!selectedRowKeys.length}>
                                    <Popconfirm
                                        disabled={!selectedRowKeys.length}
                                        onConfirm={async () => {
                                            await fetchAPI(
                                                'DELETE',
                                                'orders/details',
                                                undefined,
                                                {
                                                    ids: selectedRows
                                                        .filter(
                                                            ({ reservedCount, status, agreement }) =>
                                                                status != 'OK' &&
                                                                status != 'READY' &&
                                                                agreement != 'AGREED' &&
                                                                agreement != 'REJECTED' &&
                                                                !reservedCount
                                                        )
                                                        .map(({ id }) => id)
                                                },
                                                { handleErrorInternally: true }
                                            );
                                            await notification.success({
                                                message: this.props.intl.formatMessage({
                                                    id: 'details_table.deleted'
                                                })
                                            });

                                            if (activeKey === 'returnSurpluses') {
                                                this.getOrdersForSurpluses();
                                            } else {
                                                fetchSparePartsWorkplaceData();
                                            }
                                        }}
                                        title={<FormattedMessage id='add_order_form.delete_confirm' />}
                                    >
                                        <div>
                                            <DeleteOutlined className={Styles.actionMenuIcon} />
                                            <FormattedMessage id='delete' />
                                        </div>
                                    </Popconfirm>
                                </Menu.Item>
                            )}
                        </Menu>
                    );

                    return (
                        <HamburgerMenu actionsMenu={actionsMenu}>
                            <Button data-qa='btn_menu_details_table_order_page' icon={<MenuOutlined />} />
                        </HamburgerMenu>
                    );
                },
                key: 'actions',
                className: Styles.tableColumn,
                render: row => {
                    const { activeKey } = this.state;
                    const actionsMenu = () => (
                        <Menu>
                            <Menu.Item>
                                <Popconfirm
                                    onConfirm={async () => {
                                        const response = await fetchAPI(
                                            'PUT',
                                            'orders/details',
                                            undefined,
                                            {
                                                details: [{ id: row.id }]
                                            },
                                            { handleErrorInternally: true }
                                        );
                                        await showDetailsActionNotification(
                                            this.props.intl,
                                            'update_stage',
                                            response.all,
                                            response.success
                                        );
                                        if (activeKey === 'returnSurpluses') {
                                            this.getOrdersForSurpluses();
                                        } else {
                                            this.fetchSparePartsWorkplaceData();
                                        }
                                    }}
                                    title={<FormattedMessage id='orders.update_stage' />}
                                >
                                    <div>
                                        <RedoOutlined className={Styles.actionMenuIcon} />
                                        <FormattedMessage id='orders.update_stage' />
                                    </div>
                                </Popconfirm>
                            </Menu.Item>
                            <Menu.Item>
                                <div
                                    onClick={async () => {
                                        if (activeKey === 'returnSurpluses') {
                                            await fetchAPI(
                                                'PUT',
                                                'orders/details',
                                                undefined,
                                                {
                                                    details: [
                                                        {
                                                            id: row.id,
                                                            isCriticalByTime: !row.isCriticalByTime
                                                        }
                                                    ]
                                                },
                                                { handleErrorInternally: true }
                                            );
                                            this.getOrdersForSurpluses();
                                        } else {
                                            this.updateSparePartsWorkplaceData([
                                                {
                                                    id: row.id,
                                                    isCriticalByTime: !row.isCriticalByTime
                                                }
                                            ]);
                                        }
                                    }} 
                                >
                                    <WarningOutlined className={Styles.actionMenuIcon} />
                                    <FormattedMessage id='profile.spare_parts_workplace.critical' />
                                </div>
                            </Menu.Item>
                            <Menu.Item
                                disabled={
                                    row.status == 'GIVE_2_REPAIR' ||
                                    row.status == 'MOUNT' ||
                                    row.status == 'OK' ||
                                    row.status == 'BACK_2_STOCK' ||
                                    row.status == 'CANCEL' ||
                                    row.agreement != 'UNDEFINED' ||
                                    row.reservedCount
                                }
                                onClick={() => {
                                    this.setState({
                                        detailModalVisibleMode: 1,
                                        detailModalSelectedRow: row
                                    });
                                }}
                            >
                                <EditOutlined className={Styles.actionMenuIcon} />
                                <FormattedMessage id='edit' />
                            </Menu.Item>
                            <Menu.Item
                                disabled={
                                    row.status == 'OK' ||
                                    row.status == 'READY' ||
                                    row.agreement == 'AGREED' ||
                                    row.agreement == 'REJECTED' ||
                                    row.reservedCount
                                }
                            >
                                <Popconfirm
                                    disabled={
                                        row.status == 'OK' ||
                                        row.status == 'READY' ||
                                        row.agreement == 'AGREED' ||
                                        row.agreement == 'REJECTED' ||
                                        row.reservedCount
                                    }
                                    onConfirm={async () => {
                                        await fetchAPI(
                                            'DELETE',
                                            'orders/details',
                                            undefined,
                                            { ids: [row.id] },
                                            { handleErrorInternally: true }
                                        );

                                        if (activeKey === 'returnSurpluses') {
                                            this.getOrdersForSurpluses();
                                        } else {
                                            this.fetchSparePartsWorkplaceData();
                                        }
                                    }}
                                    title={<FormattedMessage id='add_order_form.delete_confirm' />}
                                >
                                    <div>
                                        <DeleteOutlined className={Styles.actionMenuIcon} />
                                        <FormattedMessage id='delete' />
                                    </div>
                                </Popconfirm>
                            </Menu.Item>
                            <Menu.Item
                                disabled={row.status == 'OK'}
                                onClick={async () => {
                                    const payload = {
                                        details: [
                                            {
                                                putAfterId: row.id,
                                                storeGroupId: row.storeGroupId,
                                                name: row.detailName,
                                                productCode: row.detailCode,
                                                supplierId: row.supplierId,
                                                supplierBrandId: row.supplierBrandId,
                                                purchasePrice: row.purchasePrice,
                                                count: row.count,
                                                price: row.price,
                                                orderId: row.orderId
                                            }
                                        ]
                                    };
                                    await fetchAPI('POST', 'orders/details', undefined, payload);
                                    if (activeKey === 'returnSurpluses') {
                                        this.getOrdersForSurpluses();
                                    } else {
                                        this.fetchSparePartsWorkplaceData();
                                    }
                                }}
                            >
                                <CopyOutlined className={Styles.actionMenuIcon} />
                                <FormattedMessage id='profile.spare_parts_workplace.copy' />
                            </Menu.Item>
                            <Menu.Item
                                disabled={
                                    row.status == 'GIVE_2_REPAIR' ||
                                    row.status == 'MOUNT' ||
                                    row.status == 'OK' ||
                                    row.status == 'BACK_2_STOCK' ||
                                    row.status == 'CANCEL'
                                }
                                onClick={() => {
                                    this.setState({
                                        priceRecalculationModalSelectedRow: row
                                    });
                                }}
                            >
                                <PriceTagIcon className={Styles.actionMenuIcon} />
                                <FormattedMessage id='profile.spare_parts_workplace.check' />
                            </Menu.Item>
                            <Menu.Item
                                disabled={
                                    row.status == 'ENTER_DATA' ||
                                    row.status == 'SEND' ||
                                    row.status == 'WAIT_DEL' ||
                                    row.status == 'INTAKE' ||
                                    row.status == 'RESERVE' ||
                                    row.status == 'READY' ||
                                    row.status == 'GIVE_2_REPAIR' ||
                                    row.status == 'MOUNT' ||
                                    row.status == 'OK' ||
                                    row.status == 'BACK_2_STOCK' ||
                                    row.status == 'BACK_2_SUP' ||
                                    row.status == 'CANCEL' ||
                                    activeKey === 'returnSurpluses'
                                }
                                onClick={async () => {
                                    await fetchAPI(
                                        'POST',
                                        'store_docs/order_all_possible',
                                        undefined,
                                        {
                                            ordersAppurtenanciesIds: [row.id]
                                        },
                                        { handleErrorInternally: true }
                                    );
                                    await notification.success({
                                        message: this.props.intl.formatMessage({
                                            id: 'details_table.ordered'
                                        })
                                    });

                                    this.fetchSparePartsWorkplaceData();
                                }}
                            >
                                <ShoppingOutlined className={Styles.actionMenuIcon} />
                                <FormattedMessage id='profile.spare_parts_workplace.to_order' />
                            </Menu.Item>
                            <Menu.Item
                                disabled={
                                    row.status == 'ENTER_DATA' ||
                                    row.status == 'SEARCH' ||
                                    row.status == 'CHECK' ||
                                    row.status == 'ORDER' ||
                                    row.status == 'RESERVE' ||
                                    row.status == 'READY' ||
                                    row.status == 'GIVE_2_REPAIR' ||
                                    row.status == 'MOUNT' ||
                                    row.status == 'OK' ||
                                    row.status == 'BACK_2_STOCK' ||
                                    row.status == 'BACK_2_SUP' ||
                                    row.status == 'CANCEL'
                                }
                                onClick={async () => {
                                    await this.setState({
                                        visibleSuppliersIncomeModal: true,
                                        suppliersIncomeModalRow: row
                                    });
                                }}
                            >
                                <CheckOutlined className={Styles.actionMenuIcon} />
                                <FormattedMessage id='profile.spare_parts_workplace.accept' />
                            </Menu.Item>
                            <Menu.Item
                                disabled={
                                    row.status == 'ENTER_DATA' ||
                                    row.status == 'SEARCH' ||
                                    row.status == 'CHECK' ||
                                    row.status == 'ORDER' ||
                                    row.status == 'SEND' ||
                                    row.status == 'WAIT_DEL' ||
                                    row.status == 'INTAKE' ||
                                    row.status == 'RESERVE' ||
                                    row.status == 'MOUNT' ||
                                    row.status == 'OK' ||
                                    row.status == 'BACK_2_STOCK' ||
                                    row.status == 'BACK_2_SUP' ||
                                    row.status == 'CANCEL' ||
                                    activeKey === 'returnSurpluses'
                                }
                                onClick={async () => {
                                    const response = await fetchAPI(
                                        'POST',
                                        'store_docs/transfer_reserved_all_possible',
                                        undefined,
                                        {
                                            ordersAppurtenanciesIds: [row.id],
                                            toWarehouseId: this.props.warehouses.find(
                                                ({ attribute }) => attribute == 'REPAIR_AREA'
                                            ).id
                                        },
                                        { handleErrorInternally: true }
                                    );
                                    if (response && response.error) {
                                        notification.error({
                                            message: response.message || this.props.intl.formatMessage({ id: 'error' })
                                        });
                                    } else {
                                        notification.success({
                                            message: this.props.intl.formatMessage({
                                                id: 'barcode.success'
                                            })
                                        });
                                    }
                                    if (activeKey === 'returnSurpluses') {
                                        this.getOrdersForSurpluses();
                                    } else {
                                        this.fetchSparePartsWorkplaceData();
                                    }
                                }}
                            >
                                <ArrowRightOutlined className={Styles.actionMenuIcon} />
                                <FormattedMessage id='profile.spare_parts_workplace.give' />
                            </Menu.Item>
                            <Menu.Item
                                disabled={
                                    row.status == 'ENTER_DATA' ||
                                    row.status == 'SEARCH' ||
                                    row.status == 'CHECK' ||
                                    row.status == 'ORDER' ||
                                    row.status == 'SEND' ||
                                    row.status == 'WAIT_DEL' ||
                                    row.status == 'INTAKE' ||
                                    row.status == 'RESERVE' ||
                                    row.status == 'READY' ||
                                    row.status == 'GIVE_2_REPAIR' ||
                                    row.status == 'MOUNT' ||
                                    row.status == 'OK' ||
                                    row.status == 'BACK_2_SUP' ||
                                    row.status == 'CANCEL' ||
                                    activeKey === 'returnSurpluses'
                                }
                                onClick={async () => {
                                    // returnDetailsToSupplier(selectedRows.map(({id})=>id));
                                    const response = await fetchAPI(
                                        'POST',
                                        'store_docs/transfer_reserved_all_possible',
                                        undefined,
                                        {
                                            ordersAppurtenanciesIds: [row.id],
                                            toWarehouseId: this.props.warehouses.find(
                                                ({ attribute }) => attribute == 'MAIN'
                                            ).id
                                        },
                                        { handleErrorInternally: true }
                                    );
                                    if (response && response.error) {
                                        await notification.error({
                                            message: response.message || this.props.intl.formatMessage({ id: 'error' })
                                        });
                                    } else {
                                        await notification.success({
                                            message: this.props.intl.formatMessage({
                                                id: 'barcode.success'
                                            })
                                        });
                                    }
                                    if (activeKey === 'returnSurpluses') {
                                        this.getOrdersForSurpluses();
                                    } else {
                                        this.fetchSparePartsWorkplaceData();
                                    }
                                }}
                            >
                                <ArrowLeftOutlined className={Styles.actionMenuIcon} />
                                <FormattedMessage id='profile.spare_parts_workplace.return_to_stock' />
                            </Menu.Item>
                            <Menu.Item
                                disabled={
                                    row.status == 'ENTER_DATA' ||
                                    row.status == 'SEARCH' ||
                                    row.status == 'CHECK' ||
                                    row.status == 'ORDER' ||
                                    row.status == 'SEND' ||
                                    row.status == 'WAIT_DEL' ||
                                    row.status == 'INTAKE' ||
                                    row.status == 'RESERVE' ||
                                    row.status == 'READY' ||
                                    row.status == 'GIVE_2_REPAIR' ||
                                    row.status == 'MOUNT' ||
                                    row.status == 'OK' ||
                                    row.status == 'BACK_2_STOCK' ||
                                    row.status == 'CANCEL'
                                }
                                onClick={async () => {
                                    if (activeKey === 'storageOrders') {
                                        await this.props.returnDetailsToSupplier([row.id]);
                                        this.fetchSparePartsWorkplaceData();
                                    } else if (activeKey === 'returnSurpluses') {
                                        const response = await fetchAPI(
                                            'POST',
                                            'store_docs/return_to_supplier_all_possible',
                                            undefined,
                                            {
                                                ordersAppurtenanciesIds: [row.id]
                                            },
                                            { handleErrorInternally: true }
                                        );
                                        await showDetailsActionNotification(
                                            this.props.intl,
                                            'return_to_supplier',
                                            response.all,
                                            response.success
                                        );
                                        this.getOrdersForSurpluses();
                                    }
                                }}
                            >
                                <UndoOutlined className={Styles.actionMenuIcon} />
                                <FormattedMessage id='profile.spare_parts_workplace.return_to_supplier' />
                            </Menu.Item>
                            {Boolean(_.get(row, 'variations.length') || row.leadIndex) && (
                                <Menu.Item
                                    key='detailsActionMenu.ungroup'
                                    onClick={async () => {
                                        if (activeKey === 'storageOrders') {
                                            this.updateSparePartsWorkplaceData([
                                                {
                                                    id: row.id,
                                                    groupName: null
                                                }
                                            ]);
                                        } else 
                                        if (activeKey === 'returnSurpluses') {
                                            await fetchAPI(
                                                'PUT',
                                                'orders/details',
                                                undefined,
                                                {
                                                    details: [
                                                        {
                                                            id: row.id,
                                                            groupName: null
                                                        }
                                                    ]
                                                },
                                                { handleErrorInternally: true }
                                            );
                                            this.getOrdersForSurpluses();
                                        }
                                    }}
                                >
                                    <ForkOutlined className={Styles.actionMenuIcon} />
                                    <FormattedMessage id='orders.ungroup' />
                                </Menu.Item>
                            )}
                        </Menu>
                    );

                    return (
                        <HamburgerMenu actionsMenu={actionsMenu}>
                            <Button data-qa='btn_menu_detail_table_order_page' icon={<MenuOutlined />} />
                        </HamburgerMenu>
                    );
                }
            },
            {
                title: <FormattedMessage id='order' />,
                key: 'order',
                className: Styles.tableColumn,
                ...this.getColumnSearchProps('filterByOrdNum'),
                render: row => {
                    const orderNum = row.orderNum;
                    const trimmedOrderNum = orderNum.split("-")[0];
                    return (
                        <div>
                            <div
                                style={{
                                    fontWeight: 700
                                }}
                            >
                                {trimmedOrderNum === 'MRD' ? (
                                    <Link to={`${book.order}/${row.orderId}`}>
                                        {row.orderNum}
                                    </Link>
                                ): row.orderNum}
                            </div>
                            <div style={{ fontSize: 12 }}>{dayjs(row.orderBeginDatetime).format('DD.MM.YY')}</div>
                        </div>
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.detail_code' />,
                key: 'code',
                className: Styles.tableColumn,
                ...this.getColumnSearchProps('filterByCode'),
                render: row => {
                    return (
                        <div>
                            <Tooltip title={<FormattedMessage id='details_table.product_card' />}>
                                <div
                                    style={{
                                        fontWeight: 700,
                                        textDecoration: row.detailCode && 'underline'
                                    }}
                                >
                                    {row.productId ? (
                                        <Link to={`${book.product}/${row.productId}`}>
                                            {row.foundString || row.detailCode}
                                        </Link>
                                    ) : (
                                        <span
                                            onClick={() => {
                                                this.props.setModal(MODALS.STORE_PRODUCT, {
                                                    code: row.detailCode,
                                                    brandId: row.supplierBrandId,
                                                    brandName: row.brandName,
                                                    name: row.detailName,
                                                    groupId: row.storeGroupId,
                                                    onSubmit: (id, code) => {
                                                        if (this.state.activeKey === 'returnSurpluses') {
                                                            this.getOrdersForSurpluses();
                                                        } else {
                                                            this.fetchSparePartsWorkplaceData();
                                                        }
                                                    }
                                                });
                                            }}
                                            style={{
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {row.foundString || row.detailCode || <FormattedMessage id='long_dash' />}
                                        </span>
                                    )}
                                </div>
                            </Tooltip>
                            <div style={{ fontSize: 12 }}>{row.detailName}</div>
                        </div>
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.brand' />,
                key: 'brand',
                dataIndex: 'brandName',
                className: Styles.tableColumn,
                ...this.getColumnSearchProps('filterByBrandName'),
                render: (data, row) => {
                    return data ? (
                        <Tooltip title={<FormattedMessage id='details_table.catalog_modal_title' />}>
                            <div
                                onClick={() => {
                                    if (!Number(row.reservedCount)) {
                                        this.setState({
                                            detailModalVisibleMode: 2,
                                            detailModalSelectedRow: row
                                        });
                                    }
                                }}
                                style={{
                                    cursor: 'pointer',
                                    textDecoration: data && 'underline'
                                }}
                            >
                                {data}
                            </div>
                        </Tooltip>
                    ) : (
                        <FormattedMessage id='long_dash' />
                    );
                }
            },
            {
                title: (
                    <span>
                        <FormattedMessage id='order_form_table.store_supplier_short'/>
                    </span>
                ),
                key: 'supplierName',
                className: Styles.tableColumn,
                ...this.getColumnSearchProps('filterBySupplierName'),
                render: row => {
                    return (
                        <div>
                            <Tooltip title={<FormattedMessage id='details_table.stock_availability' />}>
                                <span
                                    onClick={() => {
                                        if (!row.reservedCount && row.productId) {
                                            this.setState({
                                                warehousesModalSelectedRow: row
                                            });
                                        }
                                    }}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {row.supplierId === 0 ? (
                                        row.cellAddress ? (
                                            row.cellAddress
                                        ) : (
                                            row.warehouseName || row.supplierName
                                        )
                                    ) : (
                                        <FormattedMessage id='long_dash' />
                                    )}
                                </span>
                            </Tooltip>
                            {' / '}
                            <Tooltip title={<FormattedMessage id='details_table.suppliers_availability' />}>
                                <span
                                    onClick={() => {
                                        if (!row.reservedCount) {
                                            this.setState({
                                                supplierModalSelectedRow: row
                                            });
                                        }
                                    }}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {row.supplierId === 0 ? <FormattedMessage id='long_dash' /> : row.supplierName}
                                </span>
                            </Tooltip>
                        </div>
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.AI' />,
                key: 'AI',
                className: Styles.tableColumn,
                render: row => {
                    return <AvailabilityIndicator indexArray={row.store} />;
                }
            },
            {
                title: <FormattedMessage id='order_form_table.purchasePrice' />,
                align: 'right',
                key: 'purchasePrice',
                dataIndex: 'purchasePrice',
                className: Styles.tableColumn,
                ...this.getColumnSearchProps('filterByPurchasePrice'),
                render: (data, row) => {
                    const strVal = Number(data).toFixed(2);

                    const discount = _.get(this.props, 'discount') || 0;
                    const marge =
                        row.price || row.purchasePrice ? ((row.price - row.purchasePrice) * 100) / row.price : 100;
                    const markup = row.price && row.purchasePrice ? (row.price / row.purchasePrice - 1) * 100 : 0;
                    const content = (
                        <div>
                            <div>
                                <FormattedMessage id='order_form_table.marge' />: {marge.toFixed(0)}%
                            </div>
                            <div>
                                <FormattedMessage id='order_form_table.markup' />: {markup.toFixed(0)}%
                            </div>
                            <div>
                                <FormattedMessage id='order_form_table.discount' />: {discount.toFixed(0)}%
                            </div>
                        </div>
                    );

                    return (
                        <Tooltip title={content}>
                            <span style={{ cursor: 'pointer' }}>
                                {data ? (
                                    `${strVal}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
                                ) : (
                                    <FormattedMessage id='long_dash' />
                                )}
                            </span>
                        </Tooltip>
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.price' />,
                align: 'right',
                key: 'price',
                dataIndex: 'price',
                className: Styles.tableColumn,
                ...this.getColumnSearchProps('filterByPrice'),
                render: (data, row) => {
                    const strVal = Number(data).toFixed(2);

                    const discount = _.get(this.props, 'discount') || 0;
                    const marge =
                        row.price || row.purchasePrice ? ((row.price - row.purchasePrice) * 100) / row.price : 100;
                    const markup = row.price && row.purchasePrice ? (row.price / row.purchasePrice - 1) * 100 : 0;
                    const content = (
                        <div>
                            <div>
                                <FormattedMessage id='order_form_table.marge' />: {marge.toFixed(0)}%
                            </div>
                            <div>
                                <FormattedMessage id='order_form_table.markup' />: {markup.toFixed(0)}%
                            </div>
                            <div>
                                <FormattedMessage id='order_form_table.discount' />: {discount.toFixed(0)}%
                            </div>
                        </div>
                    );

                    return (
                        <Popover content={content} trigger='hover'>
                            <span style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                {data ? (
                                    `${strVal}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
                                ) : (
                                    <FormattedMessage id='long_dash' />
                                )}
                            </span>
                        </Popover>
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.count' />,
                align: 'right',
                key: 'count',
                dataIndex: 'count',
                className: Styles.tableColumn,
                ...this.getColumnSearchProps('filterByCount'),
                render: data => {
                    return <span>{data ? `${data}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : 0}</span>;
                }
            },
            { 
                title: <FormattedMessage id='services_table.units' />,
                align: 'right',
                key: 'measureUnit',
                className: Styles.numberColumn,
                dataIndex: 'measureUnit',
                render: data => {
                    return <span>{data || undefined}</span>;
                }
            },
            {
                title: <FormattedMessage id='storage.RESERVE' />,
                align: 'right',
                key: 'reserve',
                className: Styles.tableColumn,
                ...this.getColumnSearchProps(['reserve']),
                render: row => {
                    const disabled =
                        (row.stage == 'INSTALLED' && row.agreement != 'REJECTED') ||
                        isForbidden(this.props.user, permissions.ACCESS_CATALOGUE_STOCK);

                    return (
                        <ReserveButton
                            brands={this.props.brands}
                            detail={row}
                            disabled={disabled || this.state.activeKey === 'returnSurpluses'}
                            updateDetail={() => {
                                this.fetchSparePartsWorkplaceData();
                            }}
                        />
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.sum' />,
                align: 'right',
                key: 'sum',
                dataIndex: 'sum',
                className: Styles.tableColumn,
                ...this.getColumnSearchProps('filterBySum'),
                render: (data, row) => {
                    const strVal = Number(data).toFixed(2);

                    const discount = _.get(this.props, 'discount') || 0;
                    const marge =
                        row.price || row.purchasePrice ? ((row.price - row.purchasePrice) * 100) / row.price : 100;
                    const markup = row.price && row.purchasePrice ? (row.price / row.purchasePrice - 1) * 100 : 0;
                    const content = (
                        <div>
                            <div>
                                <FormattedMessage id='order_form_table.marge' />: {marge.toFixed(0)}%
                            </div>
                            <div>
                                <FormattedMessage id='order_form_table.markup' />: {markup.toFixed(0)}%
                            </div>
                            <div>
                                <FormattedMessage id='order_form_table.discount' />: {discount.toFixed(0)}%
                            </div>
                        </div>
                    );

                    return (
                        <Popover content={content} trigger='hover'>
                            <span style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                {data ? (
                                    `${strVal}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
                                ) : (
                                    <FormattedMessage id='long_dash' />
                                )}
                            </span>
                        </Popover>
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.PD' />,
                key: 'agreement',
                dataIndex: 'agreement',
                align: 'center',
                className: Styles.tableColumn,
                filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
                    <div style={{ padding: 8 }}>
                        {/* <Input
                            ref={node => {
                            this.searchInput = node;
                            }}
                            placeholder={this.props.intl.formatMessage({id: 'search'})}
                            value={selectedKeys[0]}
                            onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                            onPressEnter={() => this.handleSearch(selectedKeys, confirm, 'agreement')}
                            style={{ width: 188, marginBottom: 8, display: 'block' }}
                        /> */}
                        <Menu>
                            <Menu.Item
                                key='undefined'
                                onClick={() => {
                                    setSelectedKeys(['UNDEFINED']);
                                }}
                            >
                                <QuestionCircleOutlined
                                    style={{
                                        fontSize: 18,
                                        verticalAlign: 'sub',
                                        marginRight: 8
                                    }}
                                />
                                <FormattedMessage id='agreement.undefined' />
                            </Menu.Item>
                            <Menu.Item
                                key='agreed'
                                onClick={() => {
                                    setSelectedKeys(['AGREED']);
                                }}
                                style={{ color: 'var(--green)' }}
                            >
                                <CheckCircleOutlined
                                    style={{
                                        fontSize: 18,
                                        verticalAlign: 'sub',
                                        marginRight: 8,
                                        color: 'var(--green)'
                                    }}
                                />
                                <FormattedMessage id='agreement.agreed' />
                            </Menu.Item>
                            <Menu.Item
                                key='rejected'
                                onClick={() => {
                                    setSelectedKeys(['REJECTED']);
                                }}
                                style={{ color: 'rgb(255, 126, 126)' }}
                            >
                                <CloseCircleOutlined
                                    style={{
                                        fontSize: 18,
                                        marginRight: 8
                                    }}
                                />
                                <FormattedMessage id='agreement.rejected' />
                            </Menu.Item>
                        </Menu>
                        <Button
                            icon={<SearchOutlined />}
                            onClick={() => this.handleSearch(selectedKeys, confirm, 'agreement')}
                            size='small'
                            style={{ width: 90, marginRight: 8 }}
                            type='primary'
                        >
                            <FormattedMessage id='search' />
                        </Button>
                        <Button onClick={() => this.handleReset(clearFilters)} size='small' style={{ width: 90 }}>
                            <FormattedMessage id='reset' />
                        </Button>
                    </div>
                ),
                filterIcon: filtered => <FilterOutlined style={{ color: filtered ? 'var(--primary)' : undefined }} />,
                onFilter: (value, record) => String(record.agreement).toLowerCase().includes(value.toLowerCase()),
                onFilterDropdownVisibleChange: visible => {
                    if (visible) {
                        setTimeout(() => this.searchInput.select());
                    }
                },
                render: (data, row) => {
                    let color = null;
                    let icon = <QuestionCircleOutlined />;
                    switch (data) {
                        case 'REJECTED':
                            color = 'rgb(255, 126, 126)';
                            icon = <CloseCircleOutlined style={{ fontSize: 22, color: 'rgb(255, 126, 126)' }} />;
                            break;
                        case 'AGREED':
                            color = 'var(--green)';
                            icon = <CheckCircleOutlined style={{ fontSize: 22, color: 'var(--green)' }} />;
                            break;
                        default:
                            color = null;
                            icon = <QuestionCircleOutlined style={{ fontSize: 22 }} />;
                    }
                    const updateAgreement = async value => {
                        if (this.state.activeKey === 'returnSurpluses') {
                            await fetchAPI(
                                'PUT',
                                'orders/details',
                                undefined,
                                {
                                    details: [{ id: row.id, agreement: value }]
                                },
                                { handleErrorInternally: true }
                            );
                            this.getOrdersForSurpluses();
                        } else {
                            this.props.updateSparePartsWorkplaceData([
                                {
                                    id: row.id,
                                    agreement: value
                                }
                            ]);
                        }
                    };
                    const menu = (
                        <Menu>
                            <Menu.Item
                                key='undefined'
                                onClick={() => {
                                    updateAgreement('UNDEFINED');
                                }}
                            >
                                <QuestionCircleOutlined
                                    style={{
                                        fontSize: 18,
                                        verticalAlign: 'sub',
                                        marginRight: 8
                                    }}
                                />
                                <FormattedMessage id='agreement.undefined' />
                            </Menu.Item>
                            <Menu.Item
                                key='agreed'
                                onClick={() => {
                                    updateAgreement('AGREED');
                                }}
                                style={{ color: 'var(--green)' }}
                            >
                                <CheckCircleOutlined
                                    style={{
                                        fontSize: 18,
                                        verticalAlign: 'sub',
                                        marginRight: 8,
                                        color: 'var(--green)'
                                    }}
                                />
                                <FormattedMessage id='agreement.agreed' />
                            </Menu.Item>
                            <Menu.Item
                                key='rejected'
                                onClick={() => {
                                    updateAgreement('REJECTED');
                                }}
                                style={{ color: 'rgb(255, 126, 126)' }}
                            >
                                <CloseCircleOutlined
                                    style={{
                                        fontSize: 18,
                                        marginRight: 8
                                    }}
                                />
                                <FormattedMessage id='agreement.rejected' />
                            </Menu.Item>
                        </Menu>
                    );

                    return isForbidden(this.props.user, permissions.ACCESS_ORDER_DETAILS_CHANGE_STATUS) ? (
                        <span
                            style={{
                                fontSize: 24,
                                color
                            }}
                        >
                            {icon}
                        </span>
                    ) : (
                        <div>
                            <Dropdown
                                overlay={menu}
                                style={{
                                    fontSize: 24,
                                    color
                                }}
                                trigger={['click']}
                            >
                                {icon}
                            </Dropdown>
                        </div>
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.status' />,
                key: 'status',
                dataIndex: 'status',
                align: 'center',
                className: Styles.tableColumn,
                filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
                    <div style={{ padding: 8 }}>
                      <Select
                        mode='multiple'
                        allowClear
                        placeholder={<FormattedMessage id='status.placeholder' />}
                        value={selectedKeys}
                        onChange={value => {
                          setSelectedKeys(value);
                        }}
                        style={{ width: '100%' }}
                      >
                        {this.state.statuses.map(({ status }) => (
                          <Select.Option key={status} value={status}>
                            <FormattedMessage id={`status.${status}`} />
                          </Select.Option>
                        ))}
                      </Select>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                        <Button
                          type='primary'
                          size='small'
                          onClick={() => this.handleSearch(selectedKeys, confirm, 'status')}
                          style={{ marginRight: 8 }}
                        >
                          <FormattedMessage id='search' />
                        </Button>
                        <Button size='small' onClick={() => this.handleReset(clearFilters)}>
                          <FormattedMessage id='reset' />
                        </Button>
                      </div>
                    </div>
                  ),
                filterIcon: filtered => <FilterOutlined style={{ color: filtered ? 'var(--primary)' : undefined }} />,
                onFilter: (value, record) => String(record.status).toLowerCase().includes(value.toLowerCase()),
                onFilterDropdownVisibleChange: visible => {
                    if (visible) {
                        setTimeout(() => this.searchInput.select());
                    }
                },
                render: (data, row) => {
                    const { statuses } = this.state;
                    const curentStatus = statuses.find(({ status }) => status == data);

                    const updateAgreement = async value => {
                        if (
                            statuses.findIndex(({ status }) => status == data) >
                            statuses.findIndex(({ status }) => status == value)
                        ) {
                            confirm({
                                title: this.props.intl.formatMessage({
                                    id: 'profile.spare_parts_workplace.downgrade_status'
                                }),
                                content: (
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-around'
                                        }}
                                    >
                                        <div>
                                            <Button
                                                onClick={() => {
                                                    Modal.destroyAll();
                                                }}
                                            >
                                                {this.props.intl.formatMessage({
                                                    id: 'cancel'
                                                })}
                                            </Button>
                                        </div>
                                        <div>
                                            <Button
                                                onClick={async () => {
                                                    if (this.state.activeKey === 'returnSurpluses') {
                                                        await fetchAPI(
                                                            'PUT',
                                                            'orders/details',
                                                            undefined,
                                                            {
                                                                details: [{ id: row.id, status: value }]
                                                            },
                                                            { handleErrorInternally: true }
                                                        );
                                                        await this.getOrdersForSurpluses();
                                                    } else {
                                                        await this.props.updateSparePartsWorkplaceData([
                                                            {
                                                                id: row.id,
                                                                status: value
                                                            }
                                                        ]);
                                                    }
                                                    Modal.destroyAll();
                                                }}
                                                type='primary'
                                            >
                                                {this.props.intl.formatMessage({
                                                    id: 'general_settings.submit'
                                                })}
                                            </Button>
                                        </div>
                                    </div>
                                ),
                                footer: null
                            });
                        } else if (this.state.activeKey === 'returnSurpluses') {
                            await fetchAPI(
                                'PUT',
                                'orders/details',
                                undefined,
                                {
                                    details: [{ id: row.id, status: value }]
                                },
                                { handleErrorInternally: true }
                            );
                            this.getOrdersForSurpluses();
                        } else {
                            await this.props.updateSparePartsWorkplaceData([
                                {
                                    id: row.id,
                                    status: value
                                }
                            ]);
                        }
                    };
                    const menu = (
                        <Menu>
                            {statuses.map(({ status, customStatusName }) => (
                                <Menu.Item
                                    key={status}
                                    onClick={() => {
                                        updateAgreement(status);
                                    }}
                                >
                                    {customStatusName || <FormattedMessage id={`status.${status}`} />}
                                </Menu.Item>
                            ))}
                        </Menu>
                    );

                    return (
                        <Dropdown overlay={menu} trigger={['click']}>
                            <Tooltip title={<FormattedMessage id={`status.${data}.title`} />}>
                                <div
                                    style={{
                                        border: `2px solid ${row.statusColor}`,
                                        padding: '6px 2px',
                                        textAlign: 'center',
                                        fontWeight: 500,
                                        borderRadius: 6
                                    }}
                                >
                                    {curentStatus && curentStatus.customStatusName ? (
                                        curentStatus.customStatusName
                                    ) : (
                                        <FormattedMessage id={`status.${data}`} />
                                    )}
                                </div>
                            </Tooltip>
                        </Dropdown>
                    );
                }
            },
            {
                title: <FormattedMessage id='time' />,
                key: 'time',
                dataIndex: 'time',
                className: Styles.tableColumn,
                // ...this.getColumnSearchProps(['time']),
                render: (data, row) => {
                    const hours = Math.floor(data / 3600);
                    const minutes = Math.round(Math.abs((data % 3600) / 60));

                    let background;
                    let color;
                    if (this.state.hoveredTimeRowId == row.id || row.isCriticalByTime) {
                        background = 'var(--disabled)';
                        color = 'white';
                    } else if (hours >= 2) {
                        background = 'var(--db_progress)';
                    } else if (hours >= 1) {
                        background = 'var(--lightGray)';
                    } else if (hours >= 0) {
                        background = 'var(--db_approve)';
                    } else {
                        background = 'var(--approve)';
                    }

                    return (
                        <Popconfirm
                            onConfirm={async () => {
                                if (this.state.activeKey === 'returnSurpluses') {
                                    await fetchAPI(
                                        'PUT',
                                        'orders/details',
                                        undefined,
                                        {
                                            details: [
                                                {
                                                    id: row.id,
                                                    isCriticalByTime: !row.isCriticalByTime
                                                }
                                            ]
                                        },
                                        { handleErrorInternally: true }
                                    );
                                    this.getOrdersForSurpluses();
                                } else {
                                    this.props.updateSparePartsWorkplaceData([
                                        {
                                            id: row.id,
                                            isCriticalByTime: !row.isCriticalByTime
                                        }
                                    ]);
                                }
                            }}
                            title={
                                !row.isCriticalByTime ? (
                                    <FormattedMessage id='profile.spare_parts_workplace.mark_as_critical' />
                                ) : (
                                    <FormattedMessage id='profile.spare_parts_workplace.unmark_as_critical' />
                                )
                            }
                        >
                            <div
                                style={{
                                    color,
                                    background,
                                    padding: '6px 8px',
                                    textAlign: 'center',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    borderRadius: 6
                                }}
                                // onMouseEnter={()=>{
                                //     this.setState({
                                //         hoveredTimeRowId: row.id,
                                //     })
                                // }}
                                // onMouseLeave={()=>{
                                //     this.setState({
                                //         hoveredTimeRowId: undefined,
                                //     })
                                // }}
                            >
                                {this.state.hoveredTimeRowId == row.id || row.isCriticalByTime
                                    ? '!!!'
                                    : `${hours}:${minutes}`}
                            </div>
                        </Popconfirm>
                    );
                }
            }
        ];

        this.groupedColumns = [
            { key: 'name', dataIndex: 'name' },
            { key: 'count', render: row => row.childs.length }
        ];
    }

    // getColumnSearchProps = dataIndexes => ({
    //     filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
    //         <div style={{ padding: 8 }}>
    //             <Input
    //                 ref={node => {
    //                     this.searchInput = node;
    //                 }}
    //                 onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
    //                 onPressEnter={() => this.handleSearch(selectedKeys, confirm, dataIndexes)}
    //                 placeholder={this.props.intl.formatMessage({ id: 'search' })}
    //                 style={{ width: 188, marginBottom: 8, display: 'block' }}
    //                 value={selectedKeys[0]}
    //             />
    //             <Button
    //                 icon={<SearchOutlined />}
    //                 onClick={() => this.handleSearch(selectedKeys, confirm, dataIndexes)}
    //                 size='small'
    //                 style={{ width: 90, marginRight: 8 }}
    //                 type='primary'
    //             >
    //                 <FormattedMessage id='search' />
    //             </Button>
    //             <Button onClick={() => this.handleReset(clearFilters)} size='small' style={{ width: 90 }}>
    //                 <FormattedMessage id='reset' />
    //             </Button>
    //         </div>
    //     ),
    //     filterIcon: filtered => <FilterOutlined style={{ color: filtered ? 'var(--primary)' : undefined }} />,
    //     onFilter: (value, record) => {
    //         let result = false;
    //         dataIndexes.map(dataIndex => {
    //             result =
    //                 result ||
    //                 String(record[dataIndex])
    //                     .toLowerCase()
    //                     .includes(value.replace(/[^A-Za-z0-9\u0400-\u04FF]/gm, '').toLowerCase());
    //         });

    //         return result;
    //     },
    //     onFilterDropdownVisibleChange: visible => {
    //         if (visible) {
    //             setTimeout(() => this.searchInput.select());
    //         }
    //     }
    // });

    // handleSearch = (selectedKeys, confirm, dataIndexes) => {
    //     confirm();
    //     this.setState({
    //         searchText: selectedKeys[0],
    //         searchedColumn: dataIndexes
    //     });
    // };

    // handleReset = clearFilters => {
    //     clearFilters();
    //     this.setState({ searchText: '', allDetails });
    // };

    componentDidUpdate() {
        if (this.props.sparePartsData.details.length && this.state.loading) {
            this.setState({ loading: false });
        }
    }

    componentDidMount = async () => {
        this.changeSparePartsWorkplaceDataFilters({
            fromBeginDate:
                localStorage.getItem('_my.carbook.spare_parts_fromBeginDate') ||
                dayjs().add(-30, 'days').format('YYYY-MM-DD'),
            toBeginDate: localStorage.getItem('_my.carbook.spare_parts_toBeginDate') || dayjs().format('YYYY-MM-DD'),
            orderBy: localStorage.getItem('_my.carbook.spare_parts_order_by') || 'ORDER'
        });

        this.changeOrdersSurplusesDataFilters({
            fromBeginDate:
                localStorage.getItem('_my.carbook.order_surpluses_fromBeginDate') ||
                dayjs().add(-30, 'days').format('YYYY-MM-DD'),
            toBeginDate:
                localStorage.getItem('_my.carbook.order_surpluses_toBeginDate') || dayjs().format('YYYY-MM-DD'),
            orderBy: localStorage.getItem('_my.carbook.order_surpluses_order_by') || 'ORDER'
        });

        const displayType = localStorage.getItem('_my.carbook.spare_parts_displayType') || 'list';
        const allDetails = await fetchAPI('GET', 'store_groups', { keepFlat: true });
        // this.props.fetchSparePartsWorkplaceData();
        this.props.fetchBrands();
        this.props.fetchWarehouses();
        this.props.fetchSuppliers();
        const statuses = await fetchAPI('GET', 'status_settings');
        const storeGroups = await fetchAPI('GET', 'store_groups');

        const detailsTreeData = buildStoreGroupsTree(storeGroups);

        const refreshIntervalId = setInterval(this.props.fetchSparePartsWorkplaceData, 30000);
        const refreshIntervalIdSurpluses = setInterval(this.getOrdersForSurpluses(), 30000);
        setTimeout(() => {
            if (this.state.loading) this.setState({ loading: false });
        }, 2000);
        this.getOrdersForSurpluses();
        this.setState({
            detailsTreeData,
            refreshIntervalId,
            allDetails,
            statuses,
            displayType,
            refreshIntervalIdSurpluses
        });
    };

    componentWillUnmount() {
        clearInterval(this.state.refreshIntervalId);
        clearInterval(this.state.refreshIntervalIdSurpluses);
    }

    getPartsInLabor = async () => {
        // const {
        //     filterByOrdNum,
        //     filterByCode,
        //     filterByBrandName,
        //     filterBySupplierName,
        //     filterByPrice,
        //     filterByPurchasePrice,
        //     filterByCount,
        //     filterBySum,
        //     filterByAgreement,
        //     filterByStatus
        // } = this.state;
        // await fetchAPI(
        //     'GET',
        //     'orders/details',
        //     {
        //         page: this.props.filters.page,
        //         pageSize: this.props.filters.pageSize,
        //         filterByOrdNum,
        //         filterByCode,
        //         filterByBrandName,
        //         filterBySupplierName,
        //         filterByPrice,
        //         filterByPurchasePrice,
        //         filterByCount,
        //         filterBySum,
        //         filterByAgreement: filterByAgreement || null,
        //         filterByStatus
        //     },
        //     null,
        //     { handleErrorInternally: true }
        // );
    };

    getColumnSearchProps = dataIndex => {
        let filterComponent = (confirm, clearFilters) => (
            <Input
                ref={node => {
                    this.searchInput = node;
                }}
                onChange={e => {
                    this.setState({
                        [dataIndex]: e.target.value
                    });
                }}
                onPressEnter={() => this.handleSearch(confirm, dataIndex)}
                placeholder={this.props.intl.formatMessage({
                    id: 'search'
                })}
                style={{ marginBottom: 8, display: 'block', width: 180 }}
                value={this.state[dataIndex]}
            />
        );

        if (dataIndex === 'filterByBrandName') {
            filterComponent = (confirm, clearFilters) => (
                <Select
                    allowClear
                    getPopupContainer={trigger => trigger.parentNode}
                    onChange={value => {
                        this.setState({
                            filterByBrandName: value
                        });
                    }}
                    optionFilterProp='children'
                    // mode='multiple'
                    placeholder={this.props.intl.formatMessage({
                        id: 'search'
                    })}
                    showSearch
                    style={{ marginBottom: 8, display: 'block', width: 180 }}
                    value={this.state.filterByBrandName}
                >
                    {this.props.brands
                        .filter(({ brandName }) => brandName)
                        .map(({ brandId, brandName }) => (
                            <Option key={brandId} value={brandName}>
                                {brandName}
                            </Option>
                        ))}
                </Select>
            );
        }

        return {
            filterDropdown: ({ confirm, clearFilters }) => (
                <div style={{ padding: 8 }}>
                    {filterComponent(confirm, clearFilters)}
                    {dataIndex !== 'dateRange' &&
                        dataIndex !== 'filterCreatedDate' &&
                        dataIndex !== 'filtertDoneDate' && (
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-around'
                                }}
                            >
                                <Button
                                    icon={<SearchOutlined style={{ marginRight: 4 }} />}
                                    onClick={() => this.handleSearch(confirm, dataIndex)}
                                    size='small'
                                    type='primary'
                                >
                                    <FormattedMessage id='search' />
                                </Button>
                                <Button onClick={() => this.handleReset(confirm, clearFilters, dataIndex)} size='small'>
                                    <FormattedMessage id='reset' />
                                </Button>
                            </div>
                        )}
                </div>
            ),
            filterIcon: () => (
                <FilterFilled
                    style={{
                        fontSize: 14,
                        color: this.state[dataIndex] ? 'var(--primary)' : undefined
                    }}
                />
            ),
            onFilterDropdownVisibleChange: visible => {
                if (visible) {
                    setTimeout(() => this.searchInput.select(), 100);
                }
            }
        };
    };

    handleSearch = async (confirm, dataIndex) => {
        confirm();
        this.getPartsInLabor();
        await this.changeSparePartsWorkplaceDataFilters({ [dataIndex]: this.state[dataIndex] });
    };

    handleReset = async (confirm, clearFilters, dataIndex) => {
        confirm();
        clearFilters();
        await this.setState({
            [dataIndex]: null
        });
        this.getPartsInLabor();
        this.changeSparePartsWorkplaceDataFilters({ [dataIndex]: undefined });
    };

    changeSparePartsWorkplaceDataFilters = data => {
        this.setState({
            selectedRowKeys: [],
            selectedRows: []
        });
        this.props.changeSparePartsWorkplaceDataFilters(data);
    };

    changeOrdersSurplusesDataFilters = data => {
        this.setState({
            selectedRowKeys: [],
            selectedRows: []
        });
        this.props.changeOrdersSurplusesDataFilters(data);

        this.getOrdersForSurpluses();
    };

    updateSparePartsWorkplaceData = data => {
        this.setState({
            selectedRowKeys: [],
            selectedRows: []
        });
        this.props.updateSparePartsWorkplaceData(data);
    };

    updateOrdersSurpluses = async details => {
        this.setState({
            selectedRowKeys: [],
            selectedRows: []
        });

        await fetchAPI(
            'PUT',
            'orders/details',
            undefined,
            {
                details
            },
            { handleErrorInternally: true }
        );
        this.getOrdersForSurpluses();
    };

    fetchSparePartsWorkplaceData = () => {
        this.setState({
            selectedRowKeys: [],
            selectedRows: []
        });
        this.props.fetchSparePartsWorkplaceData(this.state.activeKey);
    };

    getOrdersForSurpluses = async () => {
        const ordersSurpluses = await fetchAPI(
            'GET',
            'orders/details',
            { orderStatuses: '["not_completed_supplier_expense"]' },
            null,
            { handleErrorInternally: true }
        );
        this.setState({
            detailsSurpluses: ordersSurpluses.details
        });
    };

    groupDetailsByField = (details, field) => {
        const result = [];
        details.map(detail => {
            let fieldValue;
            let fieldName;
            if (field == 'ORDER') {
                fieldValue = detail.orderId;
                fieldName = detail.orderNum;
            } else if (field == 'SUPPLIER') {
                fieldValue = detail.supplierId;
                fieldName = detail.supplierName;
            } else if (field == 'TIME') {
                fieldValue = dayjs(detail.orderBeginDatetime).format('DD-MM-YYYY');
                fieldName = dayjs(detail.orderBeginDatetime).format('DD-MM-YYYY');
            } else if (field == 'STATUSES') {
                fieldValue = detail.status;
                fieldName = this.props.intl.formatMessage({ id: `status.${detail.status}` });
            }
            const index = result.findIndex(group => group.id == fieldValue);
            if (index == -1) {
                result.push({
                    key: result.length,
                    id: fieldValue,
                    name: fieldName,
                    childs: [detail]
                });
            } else {
                result[index].childs.push(detail);
            }
        });

        return result;
    };

    render() {
        const {
            modal,
            sparePartsData,
            ordersToStorageData,
            filters,
            changeSparePartsWorkplaceTab,

            brands,
            resetModal,
            suppliers,

            user,
            intl: { formatMessage }
        } = this.props;

        const { fetchSparePartsWorkplaceData, changeSparePartsWorkplaceDataFilters, updateSparePartsWorkplaceData } =
            this;

        const { details, statistics } = sparePartsData;
        const { orderBy, filterBy, fromBeginDate, toBeginDate } = filters;
        const {
            selectedRowKeys,
            selectedRows,
            detailModalVisibleMode,
            detailModalSelectedRow,
            storageModalSelectedRow,
            supplierModalSelectedRow,
            reserveModalData,
            warehousesModalSelectedRow,
            priceRecalculationModalSelectedRow,
            loading,
            supplierId,
            setSupplierModalVisible,
            detailsTreeData,
            allDetails,
            activeKey,
            displayType,
            visibleSuppliersIncomeModal,
            suppliersIncomeModalRow,
            visibleReturnSurplusesModal,
            detailsSurpluses
        } = this.state;

        let filtredDetailsCount = 0;
        let filtredDetailsSum = 0;
        let selectedRowsDetailsSum = 0;
        let selectedRowsDetailsCount = 0;
        selectedRows.map(({ purchasePrice, count }) => {
            selectedRowsDetailsSum += purchasePrice * count;
            selectedRowsDetailsCount += count;
        });
        details.map(({ purchasePrice, count }) => {
            filtredDetailsSum += purchasePrice * count;
            filtredDetailsCount += count;
        });
        const groupedDetails = this.groupDetailsByField(details, orderBy);

        const menu = (
            <Menu>
                <Menu.Item disabled={orderBy == 'ORDER'}>
                    <div
                        onClick={() => {
                            if (this.state.activeKey === 'storageOrders') {
                                changeSparePartsWorkplaceDataFilters({ orderBy: 'ORDER' });
                            } else {
                                this.changeOrdersSurplusesDataFilters({ orderBy: 'ORDER' });
                            }
                        }}
                    >
                        <FormattedMessage id='profile.spare_parts_workplace.group_by_orders' />
                    </div>
                </Menu.Item>
                <Menu.Item disabled={orderBy == 'SUPPLIER'}>
                    <div
                        onClick={() => {
                            if (this.state.activeKey === 'storageOrders') {
                                changeSparePartsWorkplaceDataFilters({ orderBy: 'SUPPLIER' });
                            } else {
                                this.changeOrdersSurplusesDataFilters({ orderBy: 'SUPPLIER' });
                            }
                        }}
                    >
                        <FormattedMessage id='profile.spare_parts_workplace.group_by_suppliers' />
                    </div>
                </Menu.Item>
                <Menu.Item disabled={orderBy == 'TIME'}>
                    <div
                        onClick={() => {
                            if (this.state.activeKey === 'storageOrders') {
                                changeSparePartsWorkplaceDataFilters({ orderBy: 'TIME' });
                            } else {
                                this.changeOrdersSurplusesDataFilters({ orderBy: 'TIME' });
                            }
                        }}
                    >
                        <FormattedMessage id='profile.spare_parts_workplace.group_by_time' />
                    </div>
                </Menu.Item>
                <Menu.Item disabled={orderBy == 'STATUSES'}>
                    <div
                        onClick={() => {
                            if (this.state.activeKey === 'storageOrders') {
                                changeSparePartsWorkplaceDataFilters({ orderBy: 'STATUSES' });
                            } else {
                                this.changeOrdersSurplusesDataFilters({ orderBy: 'STATUSES' });
                            }
                        }}
                    >
                        <FormattedMessage id='profile.spare_parts_workplace.group_by_status' />
                    </div>
                </Menu.Item>
            </Menu>
        );

        const rowSelection = {
            selectedRowKeys,
            hideDefaultSelections: true,
            // columnTitle:
            //     <div style={{position: 'relative'}}>
            //         <Checkbox
            //             checked={selectedRowKeys.length && selectedRowKeys.length == details.length}
            //             indeterminate={selectedRowKeys.length && selectedRowKeys.length < details.length}
            //             onChange={({target})=>{
            //                 const value = target.checked;
            //                 const checked = selectedRowKeys.length && selectedRowKeys.length == details.length;
            //                 const indeterminate = selectedRowKeys.length && selectedRowKeys.length < details.length;
            //                 if(!checked || indeterminate) {
            //                     this.setState({
            //                         selectedRows: details,
            //                         selectedRowKeys: details.map(({id})=>id),
            //                     })
            //                 } else {
            //                     this.setState({
            //                         selectedRows: [],
            //                         selectedRowKeys: [],
            //                     })
            //                 }
            //             }}
            //         />
            //     </div>,
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

        const expandedRowRender = record => {
            return (
                <div style={{ margin: '4px 0 0 -4px' }}>
                    <Table
                        bordered
                        columns={this.columns()}
                        dataSource={record.childs}
                        expandable={{
                            expandedRowRender: record => (
                                <Table
                                    bordered
                                    columns={this.columns()}
                                    dataSource={record.variations}
                                    pagination={false}
                                    rowSelection={{
                                        getCheckboxProps: () => ({
                                            disabled: true
                                        })
                                    }}
                                    showHeader={false}
                                    size='small'
                                />
                            ),
                            rowExpandable: ({ variations }) => variations && variations.length
                        }}
                        loading={loading}
                        pagination={{
                            pageSize: 25
                        }}
                        rowClassName={Styles.detailsTableRow}
                        rowKey='id'
                        rowSelection={rowSelection}
                        size='small'
                    />
                </div>
            );
        };

        return (
            <Layout
                controls={
                    <React.Fragment>
                        {activeKey == 'fromOrders' && (
                            <Radio.Group
                                buttonStyle='solid'
                                onChange={event => {
                                    this.setState({
                                        displayType: event.target.value
                                    });
                                    localStorage.setItem('_my.carbook.spare_parts_displayType', event.target.value);
                                }}
                                style={{
                                    marginRight: 8
                                }}
                                value={displayType}
                            >
                                <Radio.Button value='list'>
                                    <UnorderedListOutlined
                                        style={{
                                            fontSize: 18,
                                            verticalAlign: 'middle'
                                        }}
                                    />
                                </Radio.Button>
                                <Radio.Button value='grid'>
                                    <GridIcon
                                        style={{
                                            fontSize: 18,
                                            verticalAlign: 'middle'
                                        }}
                                    />
                                </Radio.Button>
                            </Radio.Group>
                        )}
                        <Tooltip
                            title={<FormattedMessage id='spare_parts_workplace.hint_storage_orders' />}
                            zIndex={2001}
                        >
                            {activeKey !== 'fromOrders' &&
                                activeKey !== 'returnSurpluses' &&
                                !isForbidden(user, permissions.ACCESS_ORDER_DETAILS) &&
                                !isForbidden(user, permissions.SHOW_ORDERS) && (
                                    <CheckCircleOutlined
                                        className={Styles.menuIcon}
                                        onClick={async () => {
                                            await fetchAPI('POST', 'orders_ord');
                                            await fetchSparePartsWorkplaceData();
                                            await notification.success({
                                                message: formatMessage({ id: 'barcode.success' })
                                            });
                                        }}
                                        style={{
                                            marginRight: 8,
                                            color: 'var(--green)'
                                        }}
                                    />
                                )}
                        </Tooltip>
                        <Tooltip title={<FormattedMessage id='spare_parts_workplace.hint_storage_surplus' />}>
                            {activeKey === 'returnSurpluses' &&
                                !isForbidden(user, permissions.ACCESS_ORDER_DETAILS) &&
                                !isForbidden(user, permissions.SHOW_ORDERS) && (
                                    <CheckCircleOutlined
                                        className={Styles.menuIcon}
                                        disabled
                                        onClick={async () => {
                                            this.setState({
                                                visibleReturnSurplusesModal: true
                                            });
                                        }}
                                        style={{
                                            marginRight: 8,
                                            color: 'var(--green)'
                                        }}
                                    />
                                )}
                        </Tooltip>

                        <DateRangePicker
                            dateRange={[dayjs(fromBeginDate), dayjs(toBeginDate)]}
                            minimize
                            onDateChange={async ([fromBeginDate, toBeginDate]) => {
                                if (activeKey === 'fromOrders' || activeKey === 'storageOrders') {
                                    changeSparePartsWorkplaceDataFilters({
                                        fromBeginDate: fromBeginDate.format('YYYY-MM-DD'),
                                        toBeginDate: toBeginDate.format('YYYY-MM-DD')
                                    });
                                } else {
                                    this.changeOrdersSurplusesDataFilters({
                                        fromBeginDate: fromBeginDate.format('YYYY-MM-DD'),
                                        toBeginDate: toBeginDate.format('YYYY-MM-DD')
                                    });
                                }
                            }}
                            style={{ float: 'right', margin: '0px 6px 0 0' }}
                        />
                        <Dropdown overlay={menu}>
                            <SortAscendingOutlined className={Styles.menuIcon} />
                        </Dropdown>
                    </React.Fragment>
                }
                title={<FormattedMessage id='profile.spare_parts_workplace.title' />}
            >
                <Catcher>
                    <Tabs
                        activeKey={activeKey}
                        onChange={activeKey => {
                            this.setState({
                                activeKey,
                                selectedRowKeys: [],
                                selectedRows: []
                            });
                            changeSparePartsWorkplaceTab(activeKey);
                        }}
                    >
                        <TabPane
                            key='fromOrders'
                            tab={formatMessage({
                                id: 'spare_parts_workplace.from_orders'
                            })}
                        >
                            <div
                                style={{
                                    padding: '18px 0 6px 6px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-end'
                                }}
                            >
                                <div>
                                    <div style={{ padding: '0 0 8px' }}>
                                        <FormattedMessage
                                            id='spare_parts_workplace.filtred_elements'
                                            values={{
                                                filtredRowsCount: String(details.length).replace(
                                                    /\B(?=(\d{3})+(?!\d))/g,
                                                    ' '
                                                ),
                                                totalRowsCount: String(statistics.totalCount).replace(
                                                    /\B(?=(\d{3})+(?!\d))/g,
                                                    ' '
                                                ),
                                                filtredDetailsCount: filtredDetailsCount
                                                    .toFixed(1)
                                                    .replace(/\B(?=(\d{3})+(?!\d))/g, ' '),
                                                filtredDetailsSum: filtredDetailsSum
                                                    .toFixed(2)
                                                    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
                                            }}
                                        />
                                    </div>
                                    <div style={{ cursor: 'pointer', display: 'inline-block' }}>
                                        <FormattedMessage
                                            id='spare_parts_workplace.elements_selected'
                                            values={{
                                                selectedRowsCount: String(selectedRows.length).replace(
                                                    /\B(?=(\d{3})+(?!\d))/g,
                                                    ' '
                                                ),
                                                filtredRowsCount: String(details.length).replace(
                                                    /\B(?=(\d{3})+(?!\d))/g,
                                                    ' '
                                                ),
                                                selectedRowsDetailsCount: selectedRowsDetailsCount
                                                    .toFixed(1)
                                                    .replace(/\B(?=(\d{3})+(?!\d))/g, ' '),
                                                selectedRowsDetailsSum: selectedRowsDetailsSum
                                                    .toFixed(2)
                                                    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
                                            }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div>
                                        <FormattedMessage id='spare_parts_workplace.priorities' />
                                    </div>
                                    <div className={Styles.statsBlock}>
                                        <Tooltip
                                            title={<FormattedMessage id='profile.spare_parts_workplace.critical' />}
                                            zIndex={2001}
                                        >
                                            <div
                                                onClick={() => {
                                                    if (this.state.activeKey === 'storageOrders') {
                                                        changeSparePartsWorkplaceDataFilters({
                                                            filterBy: 'CRITICAL'
                                                        });
                                                    } else {
                                                        this.changeOrdersSurplusesDataFilters({
                                                            filterBy: 'CRITICAL'
                                                        });
                                                    }
                                                }}
                                            >
                                                {statistics.critical || 0}
                                            </div>
                                        </Tooltip>
                                        <Tooltip
                                            title={<FormattedMessage id='profile.spare_parts_workplace.new' />}
                                            zIndex={2001}
                                        >
                                            <div
                                                onClick={() => {
                                                    if (this.state.activeKey === 'storageOrders') {
                                                        changeSparePartsWorkplaceDataFilters({
                                                            filterBy: 'NEW'
                                                        });
                                                    } else {
                                                        this.changeOrdersSurplusesDataFilters({
                                                            filterBy: 'NEW'
                                                        });
                                                    }
                                                }}
                                            >
                                                {statistics.new || 0}
                                            </div>
                                        </Tooltip>
                                        <Tooltip
                                            title={<FormattedMessage id='profile.spare_parts_workplace.overdue' />}
                                            zIndex={2001}
                                        >
                                            <div
                                                onClick={() => {
                                                    if (this.state.activeKey === 'storageOrders') {
                                                        changeSparePartsWorkplaceDataFilters({
                                                            filterBy: 'OVERDUE'
                                                        });
                                                    } else {
                                                        this.changeOrdersSurplusesDataFilters({
                                                            filterBy: 'OVERDUE'
                                                        });
                                                    }
                                                }}
                                            >
                                                {statistics.overdue || 0}
                                            </div>
                                        </Tooltip>
                                        <Tooltip
                                            title={<FormattedMessage id='profile.spare_parts_workplace.ending' />}
                                            zIndex={2001}
                                        >
                                            <div
                                                onClick={() => {
                                                    if (this.state.activeKey === 'storageOrders') {
                                                        changeSparePartsWorkplaceDataFilters({
                                                            filterBy: 'ENDING'
                                                        });
                                                    } else {
                                                        this.changeOrdersSurplusesDataFilters({
                                                            filterBy: 'ENDING'
                                                        });
                                                    }
                                                }}
                                            >
                                                {statistics.ending || 0}
                                            </div>
                                        </Tooltip>
                                        <Tooltip
                                            title={<FormattedMessage id='spare_parts_workplace.clear_filters' />}
                                            zIndex={2001}
                                        >
                                            <div
                                                onClick={() => {
                                                    if (this.state.activeKey === 'storageOrders') {
                                                        changeSparePartsWorkplaceDataFilters({
                                                            filterBy: undefined
                                                        });
                                                    } else {
                                                        this.changeOrdersSurplusesDataFilters({
                                                            filterBy: undefined
                                                        });
                                                    }
                                                }}
                                            >
                                                <CloseCircleOutlined />
                                            </div>
                                        </Tooltip>
                                    </div>
                                </div>
                            </div>
                            {displayType == 'list' ? (
                                <Table
                                    bordered
                                    className={Styles.detailsTable}
                                    columns={this.columns()}
                                    dataSource={details}
                                    expandable={{
                                        expandedRowRender: record => (
                                            <Table
                                                bordered
                                                columns={this.columns()}
                                                dataSource={record.variations}
                                                pagination={false}
                                                rowSelection={{
                                                    getCheckboxProps: () => ({
                                                        disabled: true
                                                    })
                                                }}
                                                showHeader={false}
                                                size='small'
                                            />
                                        ),
                                        rowExpandable: ({ variations }) => variations && variations.length
                                    }}
                                    loading={loading}
                                    pagination={{
                                        pageSize: this.props.filters.pageSize,
                                        total: Math.ceil(
                                            (_.get(statistics, 'totalCount', 0) / this.props.filters.pageSize) *
                                                this.props.filters.pageSize
                                        ),

                                        current: this.props.filters.page,
                                        onChange: async (page, pageSize) => {
                                            await changeSparePartsWorkplaceDataFilters({ page, pageSize });
                                            fetchSparePartsWorkplaceData();
                                        }
                                    }}
                                    rowClassName={Styles.detailsTableRow}
                                    rowKey='id'
                                    rowSelection={rowSelection}
                                    size='small'
                                />
                            ) : (
                                <Table
                                    bordered
                                    className={Styles.detailsTable}
                                    columns={this.groupedColumns}
                                    dataSource={groupedDetails}
                                    expandedRowRender={expandedRowRender}
                                    loading={loading}
                                    pagination={{
                                        pageSize: this.props.filters.pageSize,
                                        total:
                                            Math.ceil(
                                                _.get(statistics, 'totalCount', 0) / this.props.filters.pageSize
                                            ) * this.props.filters.pageSize,

                                        current: this.props.filters.page,
                                        onChange: async (page, pageSize) => {
                                            await changeSparePartsWorkplaceDataFilters({ page, pageSize });
                                            fetchSparePartsWorkplaceData();
                                        }
                                    }}
                                    rowKey='id'
                                />
                            )}
                        </TabPane>
                        <TabPane
                            key='storageOrders'
                            tab={formatMessage({
                                id: 'spare_parts_workplace.storage_orders'
                            })}
                        >
                            <Table
                                bordered
                                className={Styles.detailsTable}
                                columns={this.columns()}
                                dataSource={ordersToStorageData.details}
                                loading={loading}
                                pagination={{
                                    pageSize: 25
                                }}
                                rowClassName={Styles.detailsTableRow}
                                rowKey='id'
                                rowSelection={rowSelection}
                                scroll={{ x: 1200 }}
                                size='small'
                            />
                        </TabPane>
                        <TabPane
                            key='returnSurpluses'
                            tab={formatMessage({
                                id: 'spare_parts_workplace.return_surpluses'
                            })}
                        >
                            <Table
                                bordered
                                className={Styles.detailsTable}
                                columns={this.columns()}
                                dataSource={detailsSurpluses}
                                loading={loading}
                                pagination={{
                                    pageSize: 25
                                }}
                                rowClassName={Styles.detailsTableRow}
                                rowKey='id'
                                rowSelection={rowSelection}
                                scroll={{ x: 1200 }}
                                size='small'
                            />
                        </TabPane>
                    </Tabs>
                    <OrderDetailModal
                        allDetails={allDetails}
                        brands={brands}
                        clientVehicleVin={_.get(detailModalSelectedRow, 'vehicleVin')}
                        hideModal={() => {
                            this.setState({
                                detailModalVisibleMode: 0,
                                detailModalSelectedRow: {}
                            });
                        }}
                        modificationId={_.get(detailModalSelectedRow, 'tecdocId')}
                        onFinish={detail => {
                            if (this.state.activeKey === 'storageOrders') {
                                this.updateSparePartsWorkplaceData([
                                    {
                                        id: detailModalSelectedRow.id,
                                        storeGroupId: detail.storeGroupId,
                                        name: detail.detailName,
                                        productCode: detail.detailCode,
                                        supplierId: detail.supplierId,
                                        supplierBrandId: detail.supplierBrandId || detail.brandId,
                                        supplierOriginalCode: detail.supplierOriginalCode,
                                        supplierProductNumber: detail.supplierProductNumber,
                                        supplierPartNumber: detail.supplierPartNumber,
                                        purchasePrice: Math.round(detail.purchasePrice * 10) / 10 || 0,
                                        count: detail.count ? detail.count : 1,
                                        price: detail.price ? Math.round(detail.price * 10) / 10 : 1,
                                        comment: detail.comment || {
                                            comment: undefined,
                                            positions: []
                                        }
                                    }
                                ]);
                            } else {
                                this.updateOrdersSurpluses([
                                    {
                                        id: detailModalSelectedRow.id,
                                        storeGroupId: detail.storeGroupId,
                                        name: detail.detailName,
                                        productCode: detail.detailCode,
                                        supplierId: detail.supplierId,
                                        supplierBrandId: detail.supplierBrandId || detail.brandId,
                                        supplierOriginalCode: detail.supplierOriginalCode,
                                        supplierProductNumber: detail.supplierProductNumber,
                                        supplierPartNumber: detail.supplierPartNumber,
                                        purchasePrice: Math.round(detail.purchasePrice * 10) / 10 || 0,
                                        count: detail.count ? detail.count : 1,
                                        price: detail.price ? Math.round(detail.price * 10) / 10 : 1,
                                        comment: detail.comment || {
                                            comment: undefined,
                                            positions: []
                                        }
                                    }
                                ]);
                            }
                        }}
                        orderId={_.get(detailModalSelectedRow, 'orderId')}
                        product={detailModalSelectedRow}
                        resetModal={resetModal}
                        treeData={detailsTreeData}
                        updateDataSource={this.updateDataSource}
                        visible={detailModalVisibleMode}
                    />
                    <DetailSupplierModal
                        brandId={_.get(supplierModalSelectedRow, 'supplierBrandId')}
                        detailCode={_.get(supplierModalSelectedRow, 'detailCode')}
                        hideButton
                        hideModal={() => {
                            this.setState({
                                supplierModalSelectedRow: undefined
                            });
                        }}
                        onSelect={({
                            businessSupplierId,
                            purchasePrice,
                            id,
                            price,
                            supplierOriginalCode,
                            supplierPartNumber
                        }) => {
                            if (this.state.activeKey === 'storageOrders') {
                                updateSparePartsWorkplaceData([
                                    {
                                        id: supplierModalSelectedRow.id,
                                        supplierId: businessSupplierId,
                                        purchasePrice,
                                        price,
                                        supplierOriginalCode,
                                        supplierPartNumber
                                    }
                                ]);
                            } else {
                                this.updateOrdersSurpluses([
                                    {
                                        id: supplierModalSelectedRow.id,
                                        supplierId: businessSupplierId,
                                        purchasePrice,
                                        price,
                                        supplierOriginalCode,
                                        supplierPartNumber
                                    }
                                ]);
                            }
                        }}
                        storeGroupId={_.get(supplierModalSelectedRow, 'storeGroupId')}
                        user={user}
                        visible={Boolean(supplierModalSelectedRow)}
                    />
                    <VinCodeModal
                        detailsTreeData={detailsTreeData}
                        disabled={
                            isForbidden(user, permissions.ACCESS_ORDER_DETAILS_VIN) ||
                            isForbidden(user, permissions.ACCESS_ORDER_DETAILS_CRUD)
                        }
                        modal={modal}
                        resetModal={resetModal}
                        vin={_.get(detailModalSelectedRow, 'vehicleVin')}
                    />
                    <StoreProductModal />

                    <DetailStorageModal
                        codeFilter={_.get(storageModalSelectedRow, 'detailCode')}
                        codeSearch
                        hideButton
                        hideModal={() => {
                            this.setState({
                                storageModalSelectedRow: undefined
                            });
                        }}
                        onSelect={(...args) => {
                            if (this.state.activeKey === 'storageOrders') {
                                updateSparePartsWorkplaceData([
                                    {
                                        id: storageModalSelectedRow.id,
                                        productCode: args[0],
                                        supplierBrandId: args[1],
                                        name: args[5],
                                        supplierOriginalCode: args[6],
                                        supplierPartNumber: args[8]
                                    }
                                ]);
                            } else {
                                this.updateOrdersSurpluses([
                                    {
                                        id: storageModalSelectedRow.id,
                                        productCode: args[0],
                                        supplierBrandId: args[1],
                                        name: args[5],
                                        supplierOriginalCode: args[6],
                                        supplierPartNumber: args[8]
                                    }
                                ]);
                            }
                        }}
                        setSupplier={(...args) => {
                            if (this.state.activeKey === 'storageOrders') {
                                updateSparePartsWorkplaceData([
                                    {
                                        id: storageModalSelectedRow.id,
                                        supplierId: args[0],
                                        purchasePrice: args[3],
                                        price: args[4],
                                        supplierOriginalCode: args[6],
                                        supplierPartNumber: args[8]
                                    }
                                ]);
                            } else {
                                this.updateOrdersSurpluses([
                                    {
                                        id: storageModalSelectedRow.id,
                                        supplierId: args[0],
                                        purchasePrice: args[3],
                                        price: args[4],
                                        supplierOriginalCode: args[6],
                                        supplierPartNumber: args[8]
                                    }
                                ]);
                            }
                        }}
                        stockMode={false}
                        storeGroupId={_.get(storageModalSelectedRow, 'storeGroupId')}
                        user={user}
                        visible={Boolean(storageModalSelectedRow)}
                    />
                    <StoreProductTrackingModal
                        hideModal={() => {
                            this.setState({
                                reserveModalData: undefined
                            });
                        }}
                        productId={reserveModalData}
                        visible={Boolean(reserveModalData)}
                    />
                    <DetailWarehousesCountModal
                        hideButton
                        hideModal={() => {
                            this.setState({
                                warehousesModalSelectedRow: undefined
                            });
                        }}
                        onSelect={(address, warehouseId) => {
                            if (this.state.activeKey === 'storageOrders') {
                                updateSparePartsWorkplaceData([
                                    {
                                        id: warehousesModalSelectedRow.id,
                                        cellAddress: address,
                                        warehouseId,
                                        supplierId: 0
                                    }
                                ]);
                            } else {
                                this.updateOrdersSurpluses([
                                    {
                                        id: warehousesModalSelectedRow.id,
                                        cellAddress: address,
                                        warehouseId,
                                        supplierId: 0
                                    }
                                ]);
                            }
                        }}
                        orderId={_.get(warehousesModalSelectedRow, 'orderId')}
                        productId={_.get(warehousesModalSelectedRow, 'productId')}
                        visible={Boolean(warehousesModalSelectedRow)}
                    />
                    <PriceRecalculationModal
                        hideButton
                        hideModal={() => {
                            this.setState({
                                priceRecalculationModalSelectedRow: undefined
                            });
                        }}
                        ordersAppurtenanciesIds={
                            priceRecalculationModalSelectedRow && priceRecalculationModalSelectedRow.id
                                ? [priceRecalculationModalSelectedRow.id]
                                : selectedRows.map(({ id }) => id)
                        }
                        updateDataSource={() => {
                            this.state.activeKey === 'storageOrders'
                                ? fetchSparePartsWorkplaceData()
                                : this.getOrdersForSurpluses();
                        }}
                        visible={Boolean(priceRecalculationModalSelectedRow)}
                    />
                    <SuppliersIncomeModal
                        hideModal={() => {
                            this.setState({
                                visibleSuppliersIncomeModal: false,
                                suppliersIncomeModalRow: undefined
                            });
                        }}
                        row={suppliersIncomeModalRow}
                        selectedRows={selectedRows}
                        updateDataSource={() => {
                            this.state.activeKey === 'storageOrders'
                                ? fetchSparePartsWorkplaceData()
                                : this.getOrdersForSurpluses();
                        }}
                        visible={visibleSuppliersIncomeModal}
                    />
                    <Modal
                        onCancel={() => this.setState({ setSupplierModalVisible: false })}
                        onOk={() => {
                            if (this.state.activeKey === 'storageOrders') {
                                updateSparePartsWorkplaceData(
                                    selectedRows.map(({ id }) => ({
                                        id,
                                        supplierId
                                    }))
                                );
                            } else {
                                this.updateOrdersSurpluses(
                                    selectedRows.map(({ id }) => ({
                                        id,
                                        supplierId
                                    }))
                                );
                            }
                            this.setState({
                                supplierId: undefined,
                                setSupplierModalVisible: undefined
                            });
                        }}
                        title={<FormattedMessage id='order_form_table.supplier' />}
                        visible={setSupplierModalVisible}
                    >
                        <div style={{ padding: 8, background: 'white' }}>
                            <Select
                                dropdownStyle={{ zIndex: 9999 }}
                                onChange={value => {
                                    this.setState({
                                        supplierId: value
                                    });
                                }}
                                optionFilterProp='children'
                                placeholder={formatMessage({ id: 'order_form_table.supplier' })}
                                showSearch
                                style={{ minWidth: 180 }}
                                value={supplierId}
                            >
                                {suppliers.map(({ name, id }) => (
                                    <Option key={id} value={id}>
                                        {name}
                                    </Option>
                                ))}
                            </Select>
                        </div>
                    </Modal>
                </Catcher>
                <AddRowsReturnSurplusesModal
                    detailsTreeData={detailsTreeData}
                    getOrdersForSurpluses={this.getOrdersForSurpluses}
                    hideModal={() => {
                        this.setState({
                            visibleReturnSurplusesModal: false
                        });
                    }}
                    visible={visibleReturnSurplusesModal}
                />
            </Layout>
        );
    }
}
