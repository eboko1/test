/* eslint-disable max-classes-per-file */
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    CloseCircleOutlined,
    CopyOutlined,
    DeleteOutlined,
    EyeInvisibleOutlined,
    EyeOutlined,
    ImportOutlined,
    MenuOutlined,
    PlusOutlined,
    PlusSquareOutlined,
    ProfileOutlined,
    QuestionCircleOutlined,
    ReconciliationOutlined,
    SaveFilled,
    SaveOutlined,
    StarFilled,
    StarOutlined,
    ToolOutlined,
    TransactionOutlined
} from '@ant-design/icons';
import {
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
    TreeSelect,
    notification
} from 'antd';
import { Catcher } from 'commons';
import { Barcode, DraggableTable, HamburgerMenu } from 'components';
import { MODALS } from 'core/modals/duck';
import _, { pick } from 'lodash';
import {
    AddServiceModal,
    ComplexesModal,
    CreateIncomeServiceModal,
    FavouriteServicesModal,
    ImportReceiptDocumentModal,
    LaborsNormHourModal
} from 'modals';
import React, { Component } from 'react';
import { FormattedMessage, injectIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import book from 'routes/book';
import { PencilIcon, PriceTagIcon, WrenchIcon } from 'theme';
import { fetchAPI, isForbidden, numeralFormatter, numeralParser, permissions } from 'utils';
import Styles from './styles.m.css';

const { SubMenu } = Menu;
const INACTIVE = 'INACTIVE';

@injectIntl
class ServicesTable extends Component {
    constructor(props) {
        super(props);
        this.state = {
            serviceModalVisible: false,
            serviceModalKey: 0,
            dataSource: [],
            selectedRowKeys: [],
            selectedRows: [],
            counterpartyTreeData: [],
            setPriceModalValue: 1,
            setPricePurchaseValue: 1
        };
        this.updateLabor = this.updateLabor.bind(this);
        this.updateDataSource = this.updateDataSource.bind(this);
        this.masterLabors = [];
        this.laborsTreeData = [];

        this.columns = () => [
            {
                title: () => {
                    const {
                        intl: { formatMessage }
                    } = this.props;

                    const { 
                        selectedRows, 
                        selectedRowKeys 
                    } = this.state;

                    const actionsMenu = (
                        <Menu className={Styles.actionMenuDropdown}>
                            <SubMenu
                                key='groupDetailsMenu.changeResponsible'
                                disabled={!selectedRows.length}
                                title={
                                    <React.Fragment>
                                        <ToolOutlined className={Styles.actionMenuIcon} style={{ fontSize: 18 }} />
                                        <FormattedMessage id='order_form_table_requests.appoint_mechanic' />
                                    </React.Fragment>
                            }
                            >
                                {this.props.employees
                                    .filter(({ posts }) => posts.find(({ postName }) => postName === 'MECHANIC'))
                                    .map(({ id: employeeId, surname, name }) => (
                                        <Menu.Item
                                            key={`groupDetailsMenu.changeResponsible.${employeeId}`}
                                            disabled={!selectedRowKeys.length}
                                            onClick={async () => {
                                                const payload = {
                                                    updateMode: true,
                                                    laborRequests: [
                                                        ...this.state.selectedRows.map(request => ({
                                                            ...this.getRequestFields(request),
                                                            counterparty: 'EMPLOYEE',
                                                            businessSupplierId: null,
                                                            employeeId
                                                        }))
                                                    ],
                                                    details: [],
                                                    services: []
                                                };
                                                console.log('payload', payload)
                                                await fetchAPI(
                                                    'PUT',
                                                    `orders/${this.props.orderId}`,
                                                    undefined,
                                                    payload
                                                );
                                                await this.updateDataSource();
                                                await console.log('updateDataSource payload', payload)
                                            }}
                                        >
                                            {surname} {name}
                                        </Menu.Item>
                                    ))}
                            </SubMenu>
                            <Menu.Item key='groupServicesMenu.addDetails' disabled={!selectedRowKeys.length}>
                                <div
                                    onClick={async () => {
                                        const { status } = await fetchAPI(
                                            'GET',
                                            'orders/status',
                                            { orderId: this.props.orderId },
                                            null
                                        );
                                        if (status === 'success') {
                                            window.location.reload();

                                            return;
                                        }
                                        const payload = {
                                            insertMode: true,
                                            details: [
                                                ...this.state.selectedRows.map(row => ({
                                                    storeGroupId: row.storeGroupId,
                                                    name: row.storeGroupName
                                                }))
                                            ]
                                        };
                                        if (this.props.tecdocId) {
                                            payload.modificationId = this.props.tecdocId;
                                        }
                                        await fetchAPI('PUT', `orders/${this.props.orderId}`, undefined, payload);
                                        await this.updateDataSource();
                                    }}
                                >
                                    <PlusSquareOutlined className={Styles.actionMenuIcon} />
                                    <FormattedMessage id='add_detail' />
                                </div>
                            </Menu.Item>
                            <Menu.Item key='groupServicesMenu.copy' disabled={!selectedRowKeys.length}>
                                <div
                                    onClick={async () => {
                                        const { status } = await fetchAPI(
                                            'GET',
                                            'orders/status',
                                            { orderId: this.props.orderId },
                                            null
                                        );
                                        if (status === 'success') {
                                            window.location.reload();

                                            return;
                                        }
                                        const payload = {
                                            insertMode: true,
                                            services: [
                                                ...this.state.selectedRows.map(row => ({
                                                    serviceId: row.laborId,

                                                    serviceName: row.serviceName,
                                                    employeeId: row.employeeId,
                                                    serviceHours: row.hours,
                                                    purchasePrice: Math.round(row.purchasePrice * 10) / 10,
                                                    count: row.count,
                                                    servicePrice: Math.round(row.price * 10) / 10,
                                                    comment: row.comment
                                                }))
                                            ]
                                        };
                                        await fetchAPI('PUT', `orders/${this.props.orderId}`, undefined, payload);
                                        await this.updateDataSource();
                                    }}
                                >
                                    <CopyOutlined className={Styles.actionMenuIcon} />
                                    <FormattedMessage id='profile.spare_parts_workplace.copy' />
                                </div>
                            </Menu.Item>
                            <Menu.Item
                                key='groupServicesMenu.updatePrices'
                                disabled={!selectedRowKeys.length}
                                onClick={() => {
                                    this.setState({
                                        setPriceModal: 'fixed',
                                        setPriceModalValue: this.props.normHourPrice
                                    });
                                }}
                            >
                                <PriceTagIcon className={Styles.actionMenuIcon} />
                                <FormattedMessage id='order_form_table.update_order_prices' />
                            </Menu.Item>
                            <Menu.Item key='groupServicesMenu.deleted' disabled={!selectedRowKeys.length}>
                                <Popconfirm
                                    disabled={!selectedRowKeys.length}
                                    onConfirm={async () => {
                                        await fetchAPI(
                                            'DELETE',
                                            `orders/${this.props.orderId}/labors`,
                                            {
                                                ids: `[${this.state.selectedRows
                                                    .filter(
                                                        ({ stage, agreement }) =>
                                                            stage == INACTIVE && agreement == 'UNDEFINED'
                                                    )
                                                    .map(({ id }) => id)}]`
                                            },
                                            undefined,
                                            { handleErrorInternally: true }
                                        );
                                        await notification.success({
                                            message: this.props.intl.formatMessage({
                                                id: 'details_table.deleted'
                                            })
                                        });
                                        await this.updateDataSource();
                                    }}
                                    title={<FormattedMessage id='add_order_form.delete_confirm' />}
                                >
                                    <div>
                                        <DeleteOutlined className={Styles.actionMenuIcon} />
                                        <FormattedMessage id='delete' />
                                    </div>
                                </Popconfirm>
                            </Menu.Item>
                            <Menu.Item key='groupServicesMenu.frequent' disabled={!selectedRowKeys.length}>
                                <Popconfirm
                                    disabled={!selectedRowKeys.length}
                                    onConfirm={async () => {
                                        await fetchAPI(
                                            'POST',
                                            'orders/frequent/labors',
                                            {
                                                storeGroupIds: `[${this.state.selectedRows.map(
                                                    ({ frequentLaborId }) => {
                                                        if (!frequentLaborId) {
                                                            return frequentLaborId;
                                                        }
                                                    }
                                                )}]`
                                            },
                                            this.state.selectedRows.map(row => ({
                                                laborId: row.laborId,
                                                name: row.serviceName,
                                                hours: row.hours ? row.hours : 1,
                                                purchasePrice: row.purchasePrice ? row.purchasePrice : 0,
                                                count: row.count ? row.count : 1
                                            })),
                                            { handleErrorInternally: true }
                                        );
                                        await notification.success({
                                            message: this.props.intl.formatMessage({
                                                id: 'details_table.added'
                                            })
                                        });
                                        await this.updateDataSource();
                                    }}
                                    title={<FormattedMessage id='add_order_form.favourite_confirm' />}
                                >
                                    <StarFilled
                                        className={Styles.actionMenuIcon}
                                        style={{ color: 'gold' }}
                                        title={this.props.intl.formatMessage({
                                            id: 'add_to_favorites'
                                        })}
                                    />
                                    <FormattedMessage id='add_to_favorites' />
                                </Popconfirm>
                            </Menu.Item>
                            <Menu.Item key='groupServicesMenu.laborStandarts' disabled={!selectedRowKeys.length}>
                                <Popconfirm
                                    disabled={!selectedRowKeys.length}
                                    onConfirm={async () => {
                                        const { region } = await fetchAPI('GET', 'business');
                                        const { success } = await fetchAPI('GET', 'labor_standarts');
                                        await fetchAPI(
                                            'POST',
                                            'labor_standarts',
                                            null,
                                            this.state.selectedRows.map(row => ({
                                                modificationId: _.get(this.props, 'selectedVehicle.modificationId'),
                                                storeGroupId: row.storeGroupId,
                                                regionId: region || 'UA.00.00.00',
                                                laborId: row.laborId,
                                                name: row.serviceName,
                                                hours: row.count ? row.count : 1,
                                                price: row.price,
                                                orderId: this.props.orderId,
                                                year: _.get(this.props, 'selectedVehicle.year'),
                                                rewriteExisting: !success,
                                                bodyId: _.get(this.props, 'selectedVehicle.bodyId')
                                            })),
                                            { handleErrorInternally: true }
                                        );
                                        await notification.success({
                                            message: this.props.intl.formatMessage({
                                                id: 'save_to_labors_standart_notifications'
                                            })
                                        });
                                    }}
                                    title={<FormattedMessage id='save_to_labors_standart_confirms' />}
                                >
                                    <SaveFilled
                                        className={Styles.actionMenuIcon}
                                        title={this.props.intl.formatMessage({
                                            id: 'save_to_labors_standart'
                                        })}
                                    />
                                    <FormattedMessage id='save_to_labors_standarts' />
                                </Popconfirm>
                            </Menu.Item>
                            <Menu.Item
                                key='groupServicesMenu.updatePrice'
                                disabled={!selectedRowKeys.length}
                                onClick={() => {
                                    this.setState({ setPriceModal: 'factor' });
                                }}
                            >
                                <TransactionOutlined className={Styles.actionMenuIcon} style={{ fontSize: 18 }} />
                                <FormattedMessage id='update_price' />
                            </Menu.Item>
                            <Menu.Item
                                key='groupServicesMenu.importDocument'
                                onClick={() =>
                                    this.props.setModal(MODALS.IMPORT_RECEIPT_DOCUMENT_MODAL, {
                                        visibleLabors: true
                                    })
                                }
                            >
                                <ImportOutlined className={Styles.actionMenuIcon} style={{ fontSize: 18 }} />
                                <FormattedMessage id='directory_page.import_document' />
                            </Menu.Item>
                            <Menu.Item
                                key='groupServicesMenu.importService'
                                disabled={
                                    !selectedRowKeys.length ||
                                    this.state.selectedRows.find(({ businessSupplierId }) => !businessSupplierId)
                                }
                                onClick={async () => {
                                    const docs = await fetchAPI(
                                        'GET',
                                        'service/store_doc/appearance',
                                        {
                                            orderId: this.props.orderId
                                        },
                                        null,
                                        { handleErrorInternally: true }
                                    );

                                    if (docs) {
                                        Modal.confirm({
                                            title: formatMessage({
                                                id: 'order_docs.add_income_services_message'
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
                                                                this.setState({
                                                                    visibleCreateIncomeServiceModal: true
                                                                });
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
                                            footer: null,
                                            okType: 'default'
                                        });
                                    } else {
                                        this.setState({
                                            visibleCreateIncomeServiceModal: true
                                        });
                                    }
                                }}
                            >
                                <ReconciliationOutlined className={Styles.actionMenuIcon} style={{ fontSize: 18 }} />
                                <FormattedMessage id='order_docs.add_income_services' />
                            </Menu.Item>
                        </Menu>
                    );

                    return <HamburgerMenu actionsMenu={actionsMenu} disabled={this.props.disabled} />;
                },
                key: 'actions',
                align: 'center',
                render: row => {
                    const disabled = row.agreement == 'AGREED' || row.agreement == 'REJECTED' || this.props.disabled;
                    
                    const actionsMenu = () => (
                        <Menu>
                            <Popconfirm
                                disabled={disabled}
                                onConfirm={async () => {
                                    await fetchAPI('DELETE', `orders/${this.props.orderId}/labors`, {
                                        ids: `[${row.id}]`
                                    });
                                    await this.updateDataSource();
                                }}
                                title={<FormattedMessage id='add_order_form.delete_confirm' />}
                            >
                                <Menu.Item key='servicesActionMenu.delete' disabled={disabled}>
                                    <div>
                                        <DeleteOutlined className={Styles.actionMenuIcon} />
                                        <FormattedMessage id='delete' />
                                    </div>
                                </Menu.Item>
                            </Popconfirm>
                            <Menu.Item key='servicesMenu.addDetails' disabled={row.agreement === 'REJECTED'}>
                                <div
                                    onClick={async () => {
                                        const { status } = await fetchAPI(
                                            'GET',
                                            'orders/status',
                                            { orderId: this.props.orderId },
                                            null
                                        );
                                        if (status === 'success') {
                                            window.location.reload();

                                            return;
                                        }
                                        const payload = {
                                            insertMode: true,
                                            details: [
                                                {
                                                    storeGroupId: row.storeGroupId,
                                                    name: row.storeGroupName
                                                }
                                            ]
                                        };

                                        if (this.props.tecdocId) {
                                            payload.modificationId = this.props.tecdocId;
                                        }
                                        await fetchAPI('PUT', `orders/${this.props.orderId}`, undefined, payload);
                                        await this.updateDataSource();
                                    }}
                                >
                                    <PlusSquareOutlined className={Styles.actionMenuIcon} />
                                    <FormattedMessage id='add_detail' />
                                </div>
                            </Menu.Item>
                            <Menu.Item key='servicesActionMenu.copy' disabled={disabled}>
                                <div
                                    onClick={async () => {
                                        const { status } = await fetchAPI(
                                            'GET',
                                            'orders/status',
                                            { orderId: this.props.orderId },
                                            null
                                        );
                                        if (status === 'success') {
                                            window.location.reload();

                                            return;
                                        }
                                        await fetchAPI(
                                            'PUT',
                                            `orders/${this.props.orderId}`,
                                            undefined,
                                            {
                                                insertMode: true,
                                                services: [
                                                    {
                                                        serviceId: row.laborId,
                                                        serviceName: row.serviceName,
                                                        employeeId: row.employeeId || null,
                                                        serviceHours: row.hours,
                                                        purchasePrice: Math.round(row.purchasePrice * 10) / 10,
                                                        count: row.count,
                                                        servicePrice: Math.round(row.price * 10) / 10,
                                                        comment: row.comment,
                                                        putAfter: row.order
                                                    }
                                                ]
                                            },
                                            { handleErrorInternally: true }
                                        );
                                        await this.updateDataSource();
                                    }}
                                >
                                    <CopyOutlined className={Styles.actionMenuIcon} />
                                    <FormattedMessage id='profile.spare_parts_workplace.copy' />
                                </div>
                            </Menu.Item>
                            <Menu.Item key='servicesActionMenu.frequent'>
                                <Popconfirm
                                    onConfirm={async () => {
                                        const data = [
                                            {
                                                laborId: row.laborId,
                                                name: row.serviceName,
                                                hours: row.hours ? row.hours : 1,
                                                purchasePrice: row.purchasePrice ? row.purchasePrice : 0,
                                                count: row.count ? row.count : 1
                                            }
                                        ];
                                        if (row.frequentLaborId) {
                                            await fetchAPI('DELETE', 'orders/frequent/labors', {
                                                ids: `[${row.frequentLaborId}]`
                                            });
                                            await this.updateDataSource();
                                        } else {
                                            await fetchAPI('POST', 'orders/frequent/labors', undefined, data);
                                            await this.updateDataSource();
                                        }
                                    }}
                                    title={
                                        row.frequentLaborId ? (
                                            <FormattedMessage id='add_order_form.favourite_remove' />
                                        ) : (
                                            <FormattedMessage id='add_order_form.favourite_confirm' />
                                        )
                                    }
                                >
                                    {row.frequentLaborId ? (
                                        <StarFilled
                                            className={Styles.actionMenuIcon}
                                            style={{
                                                color: 'gold',
                                                fontSize: 18,
                                                marginRight: 0
                                            }}
                                            title={this.props.intl.formatMessage({
                                                id: 'delete_from_favorites'
                                            })}
                                        />
                                    ) : (
                                        <StarOutlined
                                            className={Styles.actionMenuIcon}
                                            style={{
                                                color: 'gold',
                                                fontSize: 18,
                                                marginRight: 0
                                            }}
                                            title={this.props.intl.formatMessage({
                                                id: 'add_to_favorites'
                                            })}
                                        />
                                    )}
                                    <FormattedMessage
                                        id={row.frequentLaborId ? 'delete_from_favorites' : 'add_to_favorites'}
                                    />
                                </Popconfirm>
                            </Menu.Item>
                            <Menu.Item
                                key='servicesActionMenu.laborStandart'
                                disabled={disabled || !this.props.selectedVehicle || !row.laborId || !row.price}
                            >
                                <Popconfirm
                                    onConfirm={async () => {
                                        const { region } = await fetchAPI('GET', 'business');
                                        const { success } = await fetchAPI('GET', 'labor_standarts');
                                        const data = [
                                            {
                                                modificationId: _.get(this.props, 'selectedVehicle.modificationId'),
                                                storeGroupId: row.storeGroupId,
                                                regionId: region || 'UA.00.00.00',
                                                laborId: row.laborId,
                                                name: row.serviceName,
                                                hours: row.count ? row.count : 1,
                                                price: row.price,
                                                orderId: this.props.orderId,
                                                year: _.get(this.props, 'selectedVehicle.year'),
                                                rewriteExisting: !success,
                                                bodyId: _.get(this.props, 'selectedVehicle.bodyId')
                                            }
                                        ];
                                        await fetchAPI('POST', 'labor_standarts', null, data, {
                                            handleErrorInternally: true
                                        });
                                        await notification.success({
                                            message: this.props.intl.formatMessage({
                                                id: 'save_to_labors_standart_notification'
                                            })
                                        });
                                    }}
                                    title={<FormattedMessage id='save_to_labors_standart_confirm' />}
                                >
                                    <SaveOutlined
                                        className={Styles.actionMenuIcon}
                                        style={{ fontSize: 18, marginRight: 0 }}
                                        title={this.props.intl.formatMessage({
                                            id: 'save_to_labors_standart'
                                        })}
                                    />
                                    <FormattedMessage id='save_to_labors_standart' />
                                </Popconfirm>
                            </Menu.Item>
                            <Menu.Item
                                key='groupServicesMenu.importService'
                                disabled={!row.businessSupplierId}
                                onClick={async () => {
                                    const docs = await fetchAPI(
                                        'GET',
                                        '/service/store_doc/appearance',
                                        {
                                            orderId: this.props.orderId
                                        },
                                        null,
                                        { handleErrorInternally: true }
                                    );

                                    if (docs) {
                                        Modal.confirm({
                                            title: this.props.intl.formatMessage({
                                                id: 'order_docs.add_income_services_message'
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
                                                                this.setState({
                                                                    visibleCreateIncomeServiceModal: true
                                                                });
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
                                            footer: null,
                                            okType: 'default'
                                        });
                                    } else {
                                        this.setState({
                                            visibleCreateIncomeServiceModal: true
                                        });
                                    }
                                }}
                            >
                                <ReconciliationOutlined className={Styles.actionMenuIcon} style={{ fontSize: 18 }} />
                                <FormattedMessage id='order_docs.add_income_services' />
                            </Menu.Item>
                        </Menu>
                    );

                    return (
                        <HamburgerMenu actionsMenu={actionsMenu} disabled={this.props.disabled}>
                            <Button
                                data-qa='btn_show_hamburger_menu_modal_services_table_order_page'
                                icon={<MenuOutlined />}
                            />
                        </HamburgerMenu>
                    );
                }
            },
            {
                title: () => (
                    <div className={Styles.headerActions}>
                        <Tooltip placement='top' title={<FormattedMessage id='add' />}>
                            <Button
                                data-qa='btn_show_service_product_modal_services_table_order_page'
                                disabled={this.props.disabled}
                                icon={<PlusOutlined />}
                                onClick={() => {
                                    this.showServiceProductModal(-1);
                                }}
                            />
                        </Tooltip>
                        {!isForbidden(this.props.user, permissions.ACCESS_ORDER_LABORS_COMPLEXES) && (
                            <ComplexesModal
                                defaultEmployeeId={this.props.defaultEmployeeId}
                                details={this.props.details}
                                detailsTreeData={this.props.detailsTreeData}
                                disabled={this.props.disabled}
                                labors={this.props.labors}
                                laborTimeMultiplier={this.props.laborTimeMultiplier}
                                normHourPrice={this.props.normHourPrice}
                                orderId={this.props.orderId}
                                reloadOrderForm={this.props.reloadOrderForm}
                                tecdocId={this.props.tecdocId}
                            />
                        )}
                        <Tooltip placement='top' title={<FormattedMessage id='add_labor.from_recom' />}>
                            <Button
                                disabled={this.props.disabled}
                                icon={<ProfileOutlined />}
                                onClick={() => {
                                    this.props.setModal(MODALS.RECOM_TO_SERVICE);
                                }}
                            />
                        </Tooltip>
                        <Barcode
                            button
                            data-qa='btn_barcode_services_table_order_page'
                            disabled={this.props.disabled}
                            multipleMode
                            onConfirm={async (code, pref, fullCode) => {
                                const { status } = await fetchAPI(
                                    'GET',
                                    'orders/status',
                                    { orderId: this.props.orderId },
                                    null
                                );
                                if (status === 'success') {
                                    window.location.reload();

                                    return;
                                }
                                const barcodeData = await fetchAPI('GET', 'barcodes', {
                                    barcode: code
                                });
                                const laborBarcode = barcodeData.find(({ table }) => table == 'LABORS');

                                if (laborBarcode) {
                                    const payload = {
                                        insertMode: true,
                                        details: [],
                                        services: []
                                    };
                                    const labor = await fetchAPI('GET', `labors/${laborBarcode.referenceId}`);
                                    payload.services.push({
                                        serviceId: labor.id,
                                        serviceName: labor.name || labor.defaultName,
                                        employeeId: this.props.defaultEmployeeId,
                                        serviceHours: 0,
                                        purchasePrice: 0,
                                        count: Number(labor.laborPrice.normHours) || 0,
                                        servicePrice: Number(labor.laborPrice.price) || this.props.normHourPrice
                                    });
                                    await fetchAPI('PUT', `orders/${this.props.orderId}`, null, payload);
                                    await this.updateDataSource();
                                } else {
                                    notification.warning({
                                        message: this.props.intl.formatMessage({
                                            id: 'order_form_table.code_not_found'
                                        })
                                    });
                                }
                            }}
                            prefix='LBS'
                        />

                        <FavouriteServicesModal
                            defaultEmployeeId={this.props.defaultEmployeeId}
                            detailsTreeData={this.props.detailsTreeData}
                            disabled={this.props.disabled}
                            employees={this.props.employees}
                            labors={this.props.labors}
                            laborsTreeData={this.laborsTreeData}
                            laborTimeMultiplier={this.props.laborTimeMultiplier}
                            normHourPrice={this.props.normHourPrice}
                            orderId={this.props.orderId}
                            tecdocId={this.props.tecdocId}
                            updateDataSource={this.updateDataSource}
                            user={this.props.user}
                        />
                    </div>
                ),
                key: 'buttonGroup',
                render: row => {
                    const confirmed = row.agreement.toLowerCase();
                    const disabled = confirmed != 'undefined' || this.props.disabled;
                    const stageDisabled = row.stage != INACTIVE;

                    return (
                        <div className={Styles.rowActions}>
                            <Tooltip placement='top' title={<FormattedMessage id='labors_table.add_edit_button' />}>
                                <Button
                                    data-qa='btn_add_edit_button_service_product_modal_services_table_order_page'
                                    disabled={disabled}
                                    icon={<WrenchIcon />}
                                    onClick={() => {
                                        this.showServiceProductModal(row.key);
                                    }}
                                />
                            </Tooltip>
                            <QuickEditModal
                                confirmed={confirmed != 'undefined'}
                                counterpartyTreeData={this.state.counterpartyTreeData}
                                disabled={!row.laborId || this.props.disabled}
                                employees={this.props.employees}
                                labor={{ ...row }}
                                laborTimeMultiplier={this.props.laborTimeMultiplier}
                                onConfirm={this.updateLabor}
                                stageDisabled={stageDisabled}
                                tableKey={row.key}
                                tecdocId={this.props.tecdocId}
                                units={this.props.units}
                                user={this.props.user}
                            />
                        </div>
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.service_type' />,
                key: 'defaultName',
                dataIndex: 'defaultName',
                render: (data, row) => {
                    const laborId = `${String(row.laborId).substring(0, 4)}-${String(row.laborId).substring(4)}`;

                    return (
                        <div>
                            <div>{data || <FormattedMessage id='long_dash' />}</div>

                            <Link
                                style={{ textDecoration: 'underline' }}
                                to={{
                                    pathname: book.laborsPage,
                                    state: {
                                        laborId: laborId.replace('-', '')
                                    }
                                }}
                            >
                                <div style={{ fontSize: 12 }}>{row.crossId ? row.crossId : laborId}</div>
                            </Link>
                        </div>
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.detail_name' />,
                key: 'serviceName',
                dataIndex: 'serviceName',
                render: data => {
                    return data || <FormattedMessage id='long_dash' />;
                }
            },
            {
                title: (
                    <React.Fragment>
                        <FormattedMessage id='order_form_table.master' /> /{' '}
                        <FormattedMessage id='order_form_table.supplier' />
                    </React.Fragment>
                ),
                key: 'employeeId',
                render: row => {
                    return (
                        <TreeSelect
                            allowClear
                            data-qa='tree_select_counterparty_employee_services_table_order_page'
                            disabled={this.props.disabled}
                            dropdownMatchSelectWidth={280}
                            filterTreeNode={(input, node) => {
                                return (
                                    node.props.title.toLowerCase().indexOf(input.toLowerCase()) >= 0 ||
                                    String(node.props.value).indexOf(input.toLowerCase()) >= 0
                                );
                            }}
                            listHeight={440}
                            onChange={async value => {
                                if (!value) {
                                    await fetchAPI(
                                        'PUT',
                                        `orders/${this.props.orderId}`,
                                        undefined,
                                        {
                                            updateMode: true,
                                            services: [
                                                {
                                                    id: row.id,
                                                    serviceId: row.laborId,
                                                    counterparty: null,
                                                    employeeId: null,
                                                    businessSupplierId: null
                                                }
                                            ]
                                        },
                                        { handleErrorInternally: true }
                                    );
                                    await this.updateDataSource();
                                }
                            }}
                            onSelect={async (valueString, option) => {
                                const value = JSON.parse(valueString);
                                await fetchAPI(
                                    'PUT',
                                    `orders/${this.props.orderId}`,
                                    undefined,
                                    {
                                        updateMode: true,
                                        services: [
                                            {
                                                id: row.id,
                                                serviceId: row.laborId,
                                                counterparty: value.counterparty,
                                                employeeId: value.counterparty === 'EMPLOYEE' ? value.id : null,
                                                businessSupplierId: value.counterparty === 'SUPPLIER' ? value.id : null
                                            }
                                        ]
                                    },
                                    { handleErrorInternally: true }
                                );
                                await this.updateDataSource();
                            }}
                            placeholder={
                                <React.Fragment>
                                    <FormattedMessage id='order_form_table.master' /> /{' '}
                                    <FormattedMessage id='order_form_table.supplier' />
                                </React.Fragment>
                            }
                            showSearch
                            treeData={this.state.counterpartyTreeData}
                            treeDefaultExpandedKeys={['EMPLOYEE']}
                            value={
                                row.employeeId || row.businessSupplierId
                                    ? JSON.stringify({
                                          counterparty: row.counterparty || 'EMPLOYEE',
                                          id: row.counterparty === 'SUPPLIER' ? row.businessSupplierId : row.employeeId
                                      })
                                    : undefined
                            }
                        />
                    );
                }
            },
            {
                title: <FormattedMessage id='services_table.norm_hours' />,
                key: 'hours',
                align: 'center',
                dataIndex: 'hours',
                render: (data, { laborId, storeGroupId, id, price: rowPrice }) => {
                    return (
                        <Tooltip placement='top' title={<FormattedMessage id='labors_table.check_labor_hours' />}>
                            <Button
                                data-qa='btn_show_horm_hour_modal_services_table_order_page'
                                disabled={
                                    this.props.disabled ||
                                    isForbidden(this.props.user, permissions.ACCESS_NORM_HOURS_MODAL_WINDOW)
                                }
                                onClick={() => {
                                    this.props.setModal(MODALS.NORM_HOURS_MODAL, {
                                        laborId,
                                        storeGroupId,

                                        onSelect: async ({ hours, price, normHourPrice }) => {
                                            await fetchAPI(
                                                'PUT',
                                                `orders/${this.props.orderId}`,
                                                undefined,
                                                {
                                                    updateMode: true,
                                                    services: [
                                                        {
                                                            id,
                                                            serviceId: laborId,
                                                            serviceHours: hours,
                                                            count: hours * this.props.laborTimeMultiplier,
                                                            servicePrice: price || rowPrice || normHourPrice
                                                        }
                                                    ]
                                                },
                                                { handleErrorInternally: true }
                                            );
                                            this.updateDataSource();
                                        }
                                    });
                                }}
                                style={{ padding: '0px 12px' }}
                            >
                                {data ? (
                                    <React.Fragment>
                                        {data} <FormattedMessage id='order_form_table.hours_short' />
                                    </React.Fragment>
                                ) : (
                                    <ClockCircleOutlined />
                                )}
                            </Button>
                        </Tooltip>
                    );
                }
            },
            {
                title: () => (
                    <div className={Styles.numberColumn}>
                        <Button
                            icon={this.props.purchasePrices ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                            onClick={() => {
                                this.props.showPurchasePrices();
                            }}
                            type='text'
                        />
                        <FormattedMessage id='order_form_table.prime_cost' />
                    </div>
                ),
                className: Styles.numberColumn,
                key: 'primeCost',
                dataIndex: 'purchasePrice',
                render: data => {
                    if (!this.props.purchasePrices) {
                        return <FormattedMessage id='long_dash' />;
                    }

                    const strVal = Number(data).toFixed(2);

                    return (
                        <span>
                            {data ? (
                                `${strVal}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
                            ) : (
                                <FormattedMessage id='long_dash' />
                            )}
                        </span>
                    );
                }
            },
            {
                title: (
                    <div className={Styles.numberColumn}>
                        <FormattedMessage id='order_form_table.price' />
                        <p
                            style={{
                                color: 'var(--text2)',
                                fontSize: 12,
                                fontWeight: 400
                            }}
                        >
                            <FormattedMessage id='without' /> <FormattedMessage id='VAT' />
                        </p>
                    </div>
                ),
                className: Styles.numberColumn,
                key: 'price',
                dataIndex: 'price',
                render: data => {
                    const strVal = Number(data).toFixed(2);

                    return (
                        <span>
                            {data ? (
                                `${strVal}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
                            ) : (
                                <FormattedMessage id='long_dash' />
                            )}
                        </span>
                    );
                }
            },
            {
                title: (
                    <div className={Styles.numberColumn}>
                        <FormattedMessage id='order_form_table.count' />
                    </div>
                ),
                className: Styles.numberColumn,
                key: 'count',
                dataIndex: 'count',
                render: data => {
                    const strVal = Number(data).toFixed(2);

                    return <span>{data ? strVal : 0}</span>;
                }
            },
            {
                title: (
                    <div className={Styles.numberColumn}>
                        <FormattedMessage id='services_table.units' />
                    </div>
                ),
                className: Styles.numberColumn,
                key: 'measureUnit',
                dataIndex: 'measureUnit',
                render: data => {
                    return <span>{data || undefined}</span>;
                }
            },
            {
                title: (
                    <div className={Styles.numberColumn}>
                        <FormattedMessage id='order_form_table.sum' />
                        <p
                            style={{
                                color: 'var(--text2)',
                                fontSize: 12,
                                fontWeight: 400
                            }}
                        >
                            <FormattedMessage id='without' /> <FormattedMessage id='VAT' />
                        </p>
                    </div>
                ),
                className: Styles.numberColumn,
                key: 'sum',
                dataIndex: 'sum',
                render: data => {
                    const strVal = Number(data).toFixed(2);

                    return (
                        <span>
                            {data ? (
                                `${strVal}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
                            ) : (
                                <FormattedMessage id='long_dash' />
                            )}
                        </span>
                    );
                }
            },
            {
                title: () => {
                    const updateAgreement = async value => {
                        const payload = {
                            updateMode: true,
                            services: []
                        };
                        this.state.selectedRows.map(elem => {
                            payload.services.push({
                                id: elem.id,
                                serviceId: elem.laborId,
                                agreement: value.toUpperCase()
                            });
                        });
                        await fetchAPI('PUT', `orders/${this.props.orderId}`, undefined, payload);
                        this.updateDataSource();
                    };
                    const menu = (
                        <Menu onClick={this.handleMenuClick}>
                            <Menu.Item
                                key='undefined'
                                onClick={() => {
                                    updateAgreement('undefined');
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
                                    updateAgreement('agreed');
                                }}
                                style={{ color: 'var(--green)' }}
                            >
                                <CheckCircleOutlined
                                    style={{
                                        fontSize: 18,
                                        verticalAlign: 'sub',
                                        marginRight: 8
                                    }}
                                />
                                <FormattedMessage id='agreement.agreed' />
                            </Menu.Item>
                            <Menu.Item
                                key='rejected'
                                onClick={() => {
                                    updateAgreement('rejected');
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

                    return (
                        <div>
                            <FormattedMessage id='order_form_table.PD' />
                            {!isForbidden(this.props.user, permissions.ACCESS_ORDER_DETAILS_CHANGE_STATUS) && (
                                <div
                                    className={Styles.headerActions}
                                    style={{
                                        paddingTop: 6,
                                        opacity: this.state.selectedRowKeys.length == 0 && 0,
                                        marginTop: this.state.selectedRowKeys.length == 0 && '-20px',
                                        transitionDuration: '0.5s',
                                        pointerEvents: this.state.selectedRowKeys.length == 0 && 'none'
                                    }}
                                >
                                    <Dropdown overlay={menu} trigger={['click']}>
                                        <QuestionCircleOutlined
                                            style={{
                                                fontSize: 24
                                            }}
                                        />
                                    </Dropdown>
                                </div>
                            )}
                        </div>
                    );
                },
                key: 'agreement',
                align: 'center',
                dataIndex: 'agreement',
                render: (data, row) => {
                    const { key } = row;
                    const confirmed = data.toLowerCase();
                    let color = null;
                    let icon = <QuestionCircleOutlined />;
                    switch (confirmed) {
                        case 'rejected':
                            color = 'rgb(255, 126, 126)';
                            icon = <CloseCircleOutlined />;
                            break;
                        case 'agreed':
                            color = 'var(--green)';
                            icon = <CheckCircleOutlined />;
                            break;
                        default:
                            color = null;
                            icon = <QuestionCircleOutlined />;
                    }
                    const updateAgreement = value => {
                        row.agreement = value.toUpperCase();
                        this.updateLabor(key, row);
                    };
                    const menu = (
                        <Menu onClick={this.handleMenuClick}>
                            <Menu.Item
                                key='undefined'
                                onClick={() => {
                                    updateAgreement('undefined');
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
                                    updateAgreement('agreed');
                                }}
                                style={{ color: 'var(--green)' }}
                            >
                                <CheckCircleOutlined
                                    style={{
                                        fontSize: 18,
                                        verticalAlign: 'sub',
                                        marginRight: 8
                                    }}
                                />
                                <FormattedMessage id='agreement.agreed' />
                            </Menu.Item>
                            <Menu.Item
                                key='rejected'
                                onClick={() => {
                                    updateAgreement('rejected');
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
                            <Dropdown disabled={this.props.disabled} overlay={menu} trigger={['click']}>
                                <span
                                    style={{
                                        fontSize: 24,
                                        color
                                    }}
                                >
                                    {icon}
                                </span>
                            </Dropdown>
                        </div>
                    );
                }
            }
        ];
    }

    buildCounterpartyTree = async () => {
        const suppliers = await fetchAPI('GET', 'business_suppliers', {
            all: true,
            showHidden: true
        });
        const counterpartyTreeData = [
            {
                title: this.props.intl.formatMessage({ id: 'order_form_table.master' }),
                value: 'EMPLOYEE',
                selectable: false,
                children: this.props.employees
                    .filter(({ disabled, posts, id }) => {
                        if (this.props.orderServices.findIndex(({ employeeId }) => employeeId === id) !== -1) {
                            return true;
                        }

                        return !disabled && posts.findIndex(({ postName }) => postName === 'MECHANIC') !== -1;
                    })
                    .map(employee => ({
                        title: `${employee.surname} ${employee.name}`,
                        value: JSON.stringify({
                            counterparty: 'EMPLOYEE',
                            id: employee.id
                        })
                    }))
            },
            {
                title: this.props.intl.formatMessage({ id: 'order_form_table.supplier' }),
                value: 'SUPPLIER',
                selectable: false,
                children: suppliers
                    .filter(({ hide }) => !hide)
                    .map(supplier => ({
                        title: `${supplier.name}`,
                        value: JSON.stringify({
                            counterparty: 'SUPPLIER',
                            id: supplier.id
                        })
                    }))
            }
        ];
        this.setState({
            counterpartyTreeData,
            suppliers
        });
    };

    async updateTimeMultiplier(multiplier) {
        this.laborTimeMultiplier = multiplier;
        const token = localStorage.getItem('_my.carbook.pro_token');
        let url = __API_URL__;
        const params = `/orders/${this.props.orderId}`;
        url += params;
        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    Authorization: token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ laborTimeMultiplier: multiplier })
            });
            const result = await response.json();
            if (result.success) {
                console.log('OK', result);
            } else {
                console.log('BAD', result);
            }
        } catch (error) {
            console.error('ERROR:', error);
        }
    }

    showServiceProductModal(key) {
        this.setState({
            serviceModalVisible: true,
            serviceModalKey: key
        });
    }

    hideServicelProductModal() {
        this.setState({
            serviceModalVisible: false
        });
    }

    updateDataSource() {
        if (this.state.fetched) {
            this.setState({
                fetched: false
            });
        }
        const callback = data => {
            data.orderServices.map((elem, index) => {
                elem.key = index;
            });
            this.setState({
                dataSource: data.orderServices,
                selectedRowKeys: [],
                selectedRows: [],
                fetched: true
            });
        };
        this.props.reloadOrderForm(callback, 'labors');
    }

    async updateLabor(key, labor) {
        this.state.dataSource[key] = labor;
        const data = {
            updateMode: true,
            services: [
                {
                    id: labor.id,
                    serviceId: labor.laborId,
                    laborUnitId: labor.laborUnitId || 1,
                    serviceName: labor.serviceName,
                    counterparty: labor.counterparty,
                    employeeId: labor.employeeId || null,
                    businessSupplierId: labor.businessSupplierId || null,
                    serviceHours: labor.hours,
                    purchasePrice: Math.round(labor.purchasePrice * 10) / 10,
                    count: labor.count,
                    servicePrice: Math.round(labor.price * 10) / 10,
                    comment: labor.comment || {
                        comment: undefined,
                        positions: [],
                        problems: []
                    }
                    // stage: labor.stage,
                }
            ]
        };
        if (!isForbidden(this.props.user, permissions.ACCESS_ORDER_CHANGE_AGREEMENT_STATUS)) {
            data.services[0].agreement = labor.agreement;
        }
        const { status } = await fetchAPI('GET', 'orders/status', { orderId: this.props.orderId }, null);
        if (status === 'success') {
            window.location.reload();

            return;
        }
        const token = localStorage.getItem('_my.carbook.pro_token');
        let url = __API_URL__;
        const params = `/orders/${this.props.orderId}`;
        url += params;
        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    Authorization: token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            this.updateDataSource();
        } catch (error) {
            console.error('ERROR:', error);
            this.updateDataSource();
        }
    }

    fetchLaborsTree() {
        const that = this;
        const token = localStorage.getItem('_my.carbook.pro_token');
        const url = `${__API_URL__}/labors/master?makeTree=true`;
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
                that.masterLabors = data.masterLabors;
                that.buildLaborsTree();
            })
            .catch(function (error) {
                console.log('error', error);
            });
    }

    buildLaborsTree() {
        const treeData = [];
        for (let i = 0; i < this.masterLabors.length; i++) {
            const parentGroup = this.masterLabors[i];
            treeData.push({
                title: `${parentGroup.defaultMasterLaborName} (#${parentGroup.masterLaborId})`,
                name: parentGroup.defaultMasterLaborName,
                value: parentGroup.masterLaborId,
                className: Styles.groupTreeOption,
                selectable: false,
                children: []
            });
            for (let j = 0; j < parentGroup.childGroups.length; j++) {
                const childGroup = parentGroup.childGroups[j];
                treeData[i].children.push({
                    title: `${childGroup.defaultMasterLaborName} (#${childGroup.masterLaborId})`,
                    name: childGroup.defaultMasterLaborName,
                    value: childGroup.masterLaborId,
                    className: Styles.groupTreeOption,
                    selectable: false,
                    children: []
                });
                for (let k = 0; k < childGroup.childGroups.length; k++) {
                    const lastNode = childGroup.childGroups[k];
                    treeData[i].children[j].children.push({
                        title: `${lastNode.defaultMasterLaborName} (#${lastNode.masterLaborId})`,
                        name: lastNode.defaultMasterLaborName,
                        value: lastNode.masterLaborId,
                        className: Styles.groupTreeOption
                    });
                }
            }
        }
        this.laborsTreeData = treeData;
        this.setState({
            update: true
        });
    }

    componentDidMount() {
        this.fetchLaborsTree();
        this.buildCounterpartyTree();
        const tmp = [...this.props.orderServices];
        tmp.map((elem, i) => (elem.key = i));
        this.setState({
            dataSource: tmp
        });
    }

    componentDidUpdate(prevProps) {
        if (
            (prevProps.activeKey !== 'services' && this.props.activeKey === 'services') ||
            prevProps.orderServices !== this.props.orderServices
        ) {
            const tmp = [...this.props.orderServices];
            tmp.map((elem, i) => (elem.key = i));
            this.setState({
                dataSource: tmp
            });
        }
    }
    
    getRequestFields = request =>
    pick(request, [
        'id',
        'actionType',
        'counterparty',
        'employeeComment',
        'employeeId',
        'laborRequestName',
        'stage',
        'storeGroupId',
        'serviceId'
    ]);

    render() {
        const {
            user,
            isMobile,
            normHourPrice,
            disabled,
            tecdocId,
            labors,
            details,
            detailsTreeData,
            orderId,
            reloadOrderForm,
            modal,
            laborTimeMultiplier,
            defaultEmployeeId,
            employees,
            selectedVehicle,
            resetModal,
            setModal,
            units
        } = this.props;
        const {
            selectedRowKeys,
            selectedRows,
            setPriceModal,
            setPriceModalValue,
            setPricePurchaseValue,
            counterpartyTreeData,
            dataSource,
            serviceModalKey,
            serviceModalVisible,
            suppliers,
            visibleCreateIncomeServiceModal,
            suppliersIncomeModalRow
        } = this.state;
        const columns = !isMobile
            ? this.columns()
            : this.columns().filter(
                  ({ key }) =>
                      key == 'serviceName' || key == 'price' || key == 'count' || key == 'sum' || key == 'measureUnit'
              );

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
            <Catcher>
                <DraggableTable
                    addDragColumn
                    bordered
                    className={Styles.serviceTable}
                    columns={columns}
                    dataSource={dataSource}
                    onDragEnd={async (fromIndex, toIndex) => {
                        await fetchAPI(
                            'PUT',
                            'orders/swap_labors',
                            {
                                orderId: this.props.orderId,
                                order1: dataSource[fromIndex].order,
                                order2: dataSource[toIndex].order
                            },
                            undefined,
                            { handleErrorInternally: true }
                        );
                        await this.updateDataSource();
                    }}
                    onRow={(record, rowIndex) => {
                        return {
                            onClick: () => {
                                isMobile && this.showServiceProductModal(rowIndex);
                            }
                        };
                    }}
                    pagination={false}
                    rowSelection={!isMobile && rowSelection}
                    size='small'
                />
                {isMobile && (
                    <div
                        style={{
                            margin: '12px 0px 8px',
                            display: 'flex',
                            justifyContent: 'flex-end'
                        }}
                    >
                        <ComplexesModal
                            details={details}
                            detailsTreeData={detailsTreeData}
                            disabled={disabled}
                            isMobile={isMobile}
                            labors={labors}
                            normHourPrice={normHourPrice}
                            orderId={orderId}
                            reloadOrderForm={reloadOrderForm}
                            tecdocId={tecdocId}
                        />
                        <Button
                            data-qa='btn_show_service_product_modal_services_table_order_page'
                            onClick={() => this.showServiceProductModal(-1)}
                            style={{
                                margin: '0px 0px 0px 8px'
                            }}
                        >
                            <FormattedMessage id='add' />
                        </Button>
                    </div>
                )}
                <AddServiceModal
                    counterpartyTreeData={counterpartyTreeData}
                    defaultEmployeeId={defaultEmployeeId}
                    details={details}
                    detailsTreeData={detailsTreeData}
                    employees={employees}
                    hideModal={() => this.hideServicelProductModal()}
                    isMobile={isMobile}
                    labor={dataSource[serviceModalKey]}
                    labors={labors}
                    laborsTreeData={this.laborsTreeData}
                    laborTimeMultiplier={laborTimeMultiplier}
                    normHourPrice={normHourPrice}
                    orderId={orderId}
                    setModal={setModal}
                    tableKey={serviceModalKey}
                    tecdocId={tecdocId}
                    units={units}
                    updateDataSource={this.updateDataSource}
                    updateLabor={this.updateLabor}
                    user={user}
                    visible={serviceModalVisible}
                />
                <LaborsNormHourModal
                    detailsTreeData={detailsTreeData}
                    orderId={orderId}
                    resetModal={resetModal}
                    selectedVehicle={selectedVehicle}
                    tecdocId={tecdocId}
                    user={user}
                    visible={modal}
                />
                <ImportReceiptDocumentModal
                    onConfirm={this.updateDataSource}
                    orderId={orderId}
                    resetModal={() => resetModal()}
                    suppliers={suppliers || []}
                    visible={modal}
                />
                <CreateIncomeServiceModal
                    hideModal={() => {
                        this.setState({
                            visibleCreateIncomeServiceModal: false,
                            selectedRowKeys: [],
                            selectedRows: [],
                            suppliersIncomeModalRow: undefined
                        });
                    }}
                    row={suppliersIncomeModalRow}
                    selectedRows={selectedRows}
                    updateDataSource={this.updateDataSource}
                    updateLabor={this.updateLabor}
                    user={user}
                    visible={visibleCreateIncomeServiceModal}
                />
                <Modal
                    destroyOnClose
                    onCancel={() => {
                        this.setState({
                            setPriceModal: undefined,
                            setPriceModalValue: 1,
                            setPricePurchaseValue: 1
                        });
                    }}
                    onOk={async () => {
                        const payload = {
                            updateMode: true,
                            services: [
                                ...selectedRows.map(row => ({
                                    id: row.id,
                                    servicePrice:
                                        setPriceModal === 'fixed' ? setPriceModalValue : row.price * setPriceModalValue,
                                    purchasePrice:
                                        setPriceModal === 'fixed'
                                            ? setPricePurchaseValue
                                            : row.purchasePrice * setPricePurchaseValue,
                                    serviceId: row.laborId
                                }))
                            ]
                        };
                        try {
                            await fetchAPI('PUT', `orders/${orderId}`, undefined, payload, {
                                handleErrorInternally: true
                            });
                        } catch (e) {
                            notification.error({
                                message: this.props.intl.formatMessage({ id: 'error' })
                            });
                        }
                        await this.updateDataSource();
                        this.setState({
                            setPriceModal: undefined,
                            setPriceModalValue: 1,
                            setPricePurchaseValue: 1
                        });
                    }}
                    title={<FormattedMessage id='update_price' />}
                    visible={setPriceModal}
                >
                    <div style={{ margin: '0 0 8px 0' }}>
                        <FormattedMessage id={setPriceModal === 'fixed' ? 'product.sale_price' : 'factor_price'} />
                        <InputNumber
                            data-qa='input_number_set_price_table_order_page'
                            decimalSeparator=','
                            onChange={value => {
                                this.setState({
                                    setPriceModalValue: value
                                });
                            }}
                            precision={setPriceModal === 'fixed' ? 2 : 4}
                            step={setPriceModal === 'fixed' ? 5 : 0.002}
                            style={{ margin: '0 0 0 24px' }}
                            value={setPriceModalValue}
                        />
                    </div>
                    <div style={{ margin: '0 0 8px 0' }}>
                        <FormattedMessage
                            id={setPriceModal === 'fixed' ? 'order_form_table.prime_cost' : 'factor_purchase_price'}
                        />
                        <InputNumber
                            data-qa='input_number_set_price_purchase_table_order_page'
                            decimalSeparator=','
                            onChange={value => {
                                this.setState({
                                    setPricePurchaseValue: value
                                });
                            }}
                            precision={setPriceModal === 'fixed' ? 2 : 4}
                            step={setPriceModal === 'fixed' ? 5 : 0.002}
                            style={{ margin: '0 0 0 8px' }}
                            value={setPricePurchaseValue}
                        />
                    </div>
                </Modal>
            </Catcher>
        );
    }
}

export default ServicesTable;

const { Option } = Select;

@injectIntl
class QuickEditModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            visible: false
        };
        this.columns = () => [
            {
                title: <FormattedMessage id='order_form_table.service_type' />,
                key: 'defaultName',
                dataIndex: 'defaultName',
                render: data => {
                    return data || <FormattedMessage id='long_dash' />;
                }
            },
            {
                title: <FormattedMessage id='order_form_table.detail_name' />,
                key: 'serviceName',
                dataIndex: 'serviceName',
                render: data => {
                    return (
                        <Input
                            data-qa='input_service_name_table_order_page'
                            disabled={this.props.confirmed || this.props.stageDisabled}
                            onChange={event => {
                                this.state.dataSource[0].serviceName = event.target.value;
                                this.setState({
                                    update: true
                                });
                            }}
                            value={data}
                        />
                    );
                }
            },
            {
                title: (
                    <React.Fragment>
                        <FormattedMessage id='order_form_table.master' /> /{' '}
                        <FormattedMessage id='order_form_table.supplier' />
                    </React.Fragment>
                ),
                key: 'employeeId',
                render: row => {
                    return (
                        <TreeSelect
                            data-qa='treeselect_counterparty_table_order_page'
                            dropdownMatchSelectWidth={280}
                            filterTreeNode={(input, node) => {
                                return (
                                    node.props.title.toLowerCase().indexOf(input.toLowerCase()) >= 0 ||
                                    String(node.props.value).indexOf(input.toLowerCase()) >= 0
                                );
                            }}
                            getPopupContainer={trigger => trigger.parentNode}
                            listHeight={440}
                            onSelect={async (valueString, option) => {
                                const value = JSON.parse(valueString);
                                row.counterparty = value.counterparty;
                                row.employeeId = value.counterparty == 'EMPLOYEE' ? value.id : null;
                                row.businessSupplierId = value.counterparty == 'SUPPLIER' ? value.id : null;
                                this.setState({});
                            }}
                            placeholder={
                                <React.Fragment>
                                    <FormattedMessage id='order_form_table.master' /> /{' '}
                                    <FormattedMessage id='order_form_table.supplier' />
                                </React.Fragment>
                            }
                            showSearch
                            style={{ maxWidth: 180, color: 'var(--text)' }}
                            treeData={this.props.counterpartyTreeData}
                            treeDefaultExpandedKeys={['EMPLOYEE']}
                            value={
                                row.employeeId || row.businessSupplierId
                                    ? JSON.stringify({
                                          counterparty: row.counterparty || 'EMPLOYEE',
                                          id: row.counterparty == 'SUPPLIER' ? row.businessSupplierId : row.employeeId
                                      })
                                    : undefined
                            }
                        />
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.purchasePrice' />,
                key: 'purchasePrice',
                dataIndex: 'purchasePrice',
                render: data => {
                    return (
                        <InputNumber
                            className={Styles.serviceNumberInput}
                            data-qa='input_number_purchasePrice_table_order_page'
                            decimalSeparator=','
                            formatter={value => numeralFormatter(value)}
                            min={0}
                            onChange={value => {
                                this.state.dataSource[0].purchasePrice = value;
                                this.setState({
                                    update: true
                                });
                            }}
                            parser={value => numeralParser(value)}
                            value={Math.round(data * 100) / 100 || 0}
                        />
                    );
                }
            },
            {
                title: (
                    <div>
                        <FormattedMessage id='order_form_table.price' />
                        <p
                            style={{
                                color: 'var(--text2)',
                                fontSize: 12,
                                fontWeight: 400
                            }}
                        >
                            <FormattedMessage id='without' /> <FormattedMessage id='VAT' />
                        </p>
                    </div>
                ),
                key: 'price',
                dataIndex: 'price',
                render: data => {
                    return (
                        <InputNumber
                            className={Styles.serviceNumberInput}
                            data-qa='input_number_price_coll_table_order_page'
                            decimalSeparator=','
                            disabled={this.props.confirmed}
                            formatter={value => numeralFormatter(value)}
                            min={0}
                            onChange={value => {
                                this.state.dataSource[0].price = value;
                                this.state.dataSource[0].sum = value * this.state.dataSource[0].count;
                                this.setState({
                                    update: true
                                });
                            }}
                            parser={value => numeralParser(value)}
                            value={Math.round(data * 100) / 100 || 1}
                        />
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.count' />,
                key: 'count',
                dataIndex: 'count',
                render: data => {
                    return (
                        <InputNumber
                            className={Styles.serviceNumberInput}
                            data-qa='input_number_count_table_order_page'
                            decimalSeparator=','
                            disabled={this.props.confirmed}
                            formatter={value => numeralFormatter(value)}
                            min={0}
                            onChange={value => {
                                this.state.dataSource[0].count = value;
                                this.state.dataSource[0].sum = value * this.state.dataSource[0].price;
                                this.setState({
                                    update: true
                                });
                            }}
                            parser={value => numeralParser(value)}
                            precision={2}
                            step={0.1}
                            value={data || 0}
                        />
                    );
                }
            },
            {
                title: (
                    <React.Fragment>
                        <FormattedMessage id='services_table.units' /> <span style={{ color: 'red' }}>*</span>
                    </React.Fragment>
                ),
                key: 'laborUnitId',
                dataIndex: 'laborUnitId',
                width: '5%',
                render: (data, elem) => {
                    return (
                        <Select
                            ref={node => (this.laborRef = node)}
                            allowClear
                            data-qa='select_labor_unit_id_add_service_modal'
                            disabled={this.state.editing || elem.related}
                            dropdownMatchSelectWidth={100}
                            filterOption={(input, option) => {
                                const parts = input.toLowerCase().split(' ');

                                return (
                                    String(option.children).toLowerCase().indexOf(input.toLowerCase()) >= 0 ||
                                    String(option.value).indexOf(input.toLowerCase()) >= 0 ||
                                    String(option.cross_id).toLowerCase().indexOf(input.toLowerCase()) >= 0 ||
                                    String(option.barcode).toLowerCase().indexOf(input.toLowerCase()) >= 0 ||
                                    parts.every(part => String(option.children).toLowerCase().includes(part))
                                );
                            }}
                            getPopupContainer={trigger => trigger.parentNode}
                            onChange={(value, option) => {
                                this.state.dataSource[0].laborUnitId = value;
                                this.setState({
                                    update: true
                                });
                            }}
                            placeholder={this.props.intl.formatMessage({
                                id: 'services_table.units_placeholder'
                            })}
                            showAction={['focus', 'click']}
                            showSearch
                            style={{ width: 100, color: 'var(--text)' }}
                            value={data}
                        >
                            {this.props.units.map((elem, index) => (
                                <Option key={index} value={elem.id}>
                                    {elem.shortcut}
                                </Option>
                            ))}
                        </Select>
                    );
                }
            },
            {
                title: (
                    <div>
                        <FormattedMessage id='order_form_table.sum' />
                        <p
                            style={{
                                color: 'var(--text2)',
                                fontSize: 12,
                                fontWeight: 400
                            }}
                        >
                            <FormattedMessage id='without' /> <FormattedMessage id='VAT' />
                        </p>
                    </div>
                ),
                key: 'sum',
                dataIndex: 'sum',
                render: data => {
                    return (
                        <InputNumber
                            className={Styles.serviceNumberInput}
                            data-qa='input_number_sum_coll_table_order_page'
                            decimalSeparator=','
                            disabled
                            formatter={value => numeralFormatter(value)}
                            parser={value => numeralParser(value)}
                            style={{ color: 'black' }}
                            value={Math.round(data * 10) / 10 || 1}
                        />
                    );
                }
            }
        ];
    }

    handleOk = () => {
        this.setState({
            visible: false
        });
        this.props.onConfirm(this.props.tableKey, this.state.dataSource[0]);
    };

    handleCancel = () => {
        this.setState({
            visible: false
        });
    };

    render() {
        return (
            <React.Fragment>
                <Tooltip placement='top' title={<FormattedMessage id='quick_edit' />}>
                    <Button
                        data-qa='btn_quick_edit_table_order_page'
                        disabled={this.props.disabled}
                        icon={<PencilIcon />}
                        onClick={() => {
                            this.setState({
                                visible: true,
                                dataSource: [this.props.labor]
                            });
                        }}
                    />
                </Tooltip>
                <Modal
                    maskClosable={false}
                    onCancel={this.handleCancel}
                    onOk={this.handleOk}
                    title={<FormattedMessage id='order_form_table.quick_edit' />}
                    visible={this.state.visible}
                    width='80%'
                >
                    <Table
                        bordered
                        columns={this.columns()}
                        dataSource={this.state.dataSource}
                        pagination={false}
                        size='small'
                    />
                </Modal>
            </React.Fragment>
        );
    }
}
