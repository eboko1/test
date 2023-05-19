/* eslint-disable max-classes-per-file */
import { ClockCircleOutlined, CloseOutlined, DeleteOutlined, FormOutlined, MessageOutlined } from '@ant-design/icons';
import { Button, Checkbox, Input, InputNumber, Modal, notification, Select, Table, Tooltip, TreeSelect } from 'antd';
import { MODALS } from 'core/modals/duck';
import _ from 'lodash';
import React from 'react';
import { FormattedMessage, injectIntl } from 'react-intl';
import { fetchAPI, filterTreeNodeByPart, numeralFormatter, numeralParser } from 'utils';
import Styles from './styles.m.css';

const { Option } = Select;
const { confirm } = Modal;

@injectIntl
class AddServiceModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            editing: false,
            mainTableSource: [],
            relatedServices: [],
            relatedServicesCheckbox: false,
            relatedDetailCheckbox: localStorage.getItem('_my.carbook.relatedDetailCheckbox') || false
        };
        this.labors = [];
        this.masterLabors = [];
        this.storeGroups = [];
        this.laborsTreeData = [];
        this.brandOptions = [];
        this.servicesOptions = [];
        this.employeeOptions = [];
        this.relatedDetailsOptions = [];

        // this.laborRef = React.createRef();

        this.columns = () => [
            {
                key: 'checked',
                dataIndex: 'checked',
                width: 'min-content',
                render: (data, elem) => {
                    return elem.related ? (
                        <Checkbox
                            checked={data}
                            data-qa='checkbox_add_service_modal'
                            onChange={({ target }) => {
                                elem.checked = target.checked;
                                this.setState({});
                            }}
                        />
                    ) : null;
                }
            },
            {
                title: <FormattedMessage id='services_table.store_group' />,
                key: 'storeGroupId',
                dataIndex: 'storeGroupId',
                width: '10%',
                render: (data, elem) => {
                    return (
                        <TreeSelect
                            className={Styles.groupsTreeSelect}
                            data-qa='tree_select_store_group_id_add_service_modal'
                            disabled={this.state.editing || Boolean(elem.masterLaborId)}
                            dropdownMatchSelectWidth={280}
                            filterTreeNode={filterTreeNodeByPart}
                            getPopupContainer={() => document.querySelector('.addLaborModal')}
                            listHeight={440}
                            onSelect={(value, option) => {
                                elem.storeGroupId = value;
                                elem.laborId = undefined;
                                elem.serviceName = undefined;
                                this.filterOptions(elem.masterLaborId, value);
                                this.setState({});
                            }}
                            placeholder={this.props.intl.formatMessage({
                                id: 'services_table.store_group'
                            })}
                            showSearch
                            style={{ maxWidth: 320, minWidth: 100, color: 'var(--text)' }}
                            treeData={this.props.detailsTreeData}
                            value={data}
                        />
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.service_type' />,
                key: 'masterLaborId',
                dataIndex: 'masterLaborId',
                width: '10%',
                render: (data, elem) => {
                    return (
                        <TreeSelect
                            className={Styles.groupsTreeSelect}
                            data-qa='tree_select_master_labor_id_add_service_modal'
                            disabled={this.state.editing || Boolean(elem.storeGroupId)}
                            dropdownMatchSelectWidth={280}
                            filterTreeNode={filterTreeNodeByPart}
                            getPopupContainer={() => document.querySelector('.addLaborModal')}
                            listHeight={440}
                            onSelect={(value, option) => {
                                elem.masterLaborId = value;
                                this.filterOptions(value, elem.storeGroupId);
                                this.setState({});
                            }}
                            placeholder={this.props.intl.formatMessage({
                                id: 'order_form_table.service_type'
                            })}
                            showSearch
                            style={{ maxWidth: 180, minWidth: 100, color: 'var(--text)' }}
                            treeData={this.props.laborsTreeData}
                            value={data}
                        />
                    );
                }
            },
            {
                title: (
                    <React.Fragment>
                        <FormattedMessage id='services_table.labor' /> <span style={{ color: 'red' }}>*</span>
                    </React.Fragment>
                ),
                key: 'laborId',
                dataIndex: 'laborId',
                width: '15%',
                render: (data, elem) => {
                    const currentServiceOption = this.servicesOptions.find(labor => labor.id == data);

                    return (
                        <Select
                            ref={node => (this.laborRef = node)}
                            allowClear
                            data-qa='select_labor_id_add_service_modal'
                            disabled={this.state.editing || elem.related}
                            dropdownMatchSelectWidth={420}
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
                            getPopupContainer={() => document.querySelector('.addLaborModal')}
                            onChange={(value, option) => {
                                if (option) {
                                    const price = option.price ? option.price : Number(this.props.normHourPrice);
                                    const count = option.norm_hours || 1;
                                    elem.laborId = value;
                                    elem.serviceName = option.children;
                                    elem.masterLaborId = option.master_id;
                                    elem.storeGroupId = option.store_group_id;
                                    elem.count = option.hours;
                                    elem.price = price;
                                    elem.sum = price * count;
                                    elem.specificationId = option.specificationId;
                                    elem.laborUnitId = option.laborUnitId;
                                    if (!elem.related) {
                                        this.getRelatedLabors(value);
                                    }
                                } else {
                                    elem.laborId = value;
                                    elem.serviceName = value;
                                    elem.masterLaborId = value;
                                    elem.storeGroupId = value;
                                    elem.specificationId = value;
                                    this.state.relatedLabors = [];
                                }
                                this.setState({});
                            }}
                            placeholder={this.props.intl.formatMessage({
                                id: 'services_table.labor'
                            })}
                            showAction={['focus', 'click']}
                            showSearch
                            style={{ minWidth: 100, color: 'var(--text)' }}
                            value={!elem.related ? data : elem.name}
                        >
                            {this.servicesOptions.map((elem, index) => (
                                <Option
                                    key={index}
                                    barcode={elem.barcode}
                                    cross_id={elem.crossId}
                                    hours={elem.laborPrice.normHours}
                                    laborUnitId={elem.laborUnitId}
                                    master_id={elem.masterLaborId}
                                    price={elem.laborPrice.price}
                                    specificationId={elem.specificationId}
                                    store_group_id={elem.storeGroupId}
                                    value={elem.id}
                                >
                                    {elem.customName || elem.name}
                                </Option>
                            ))}
                        </Select>
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.detail_name' />,
                key: 'serviceName',
                dataIndex: 'serviceName',
                width: '15%',
                render: (data, elem) => {
                    return (
                        <Input
                            data-qa='input_service_name_add_service_modal'
                            disabled={this.state.editing && elem.stage != 'INACTIVE'}
                            onChange={({ target }) => {
                                const { value } = target;
                                elem.serviceName = value;
                                this.setState({});
                            }}
                            placeholder={this.props.intl.formatMessage({
                                id: 'order_form_table.detail_name'
                            })}
                            style={{ minWidth: 160 }}
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
                            data-qa='tree_select_employee_id_add_service_modal'
                            dropdownMatchSelectWidth={280}
                            filterTreeNode={(input, node) => {
                                return (
                                    node.props.title.toLowerCase().indexOf(input.toLowerCase()) >= 0 ||
                                    String(node.props.value).indexOf(input.toLowerCase()) >= 0
                                );
                            }}
                            getPopupContainer={() => document.querySelector('.addLaborModal')}
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
                title: <FormattedMessage id='comment' />,
                key: 'comment',
                dataIndex: 'comment',
                render: (data, elem) => {
                    let detail = elem.serviceName;
                    if (detail && detail.indexOf(' - ') > -1) {
                        detail = detail.slice(0, detail.indexOf(' - '));
                    }

                    return (
                        <CommentaryButton
                            commentary={
                                data || {
                                    comment: undefined,
                                    positions: [],
                                    problems: []
                                }
                            }
                            data-qa='button_comment_add_service_modal'
                            detail={detail}
                            disabled={elem.laborId == null}
                            setComment={(comment, positions, problems) => {
                                elem.comment = {
                                    comment,
                                    positions,
                                    problems
                                };
                                elem.serviceName = comment || elem.serviceName;
                                this.setState({});
                            }}
                        />
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.purchasePrice' />,
                key: 'purchasePrice',
                dataIndex: 'purchasePrice',
                render: (data, elem) => {
                    return (
                        <InputNumber
                            className={Styles.serviceNumberInput}
                            data-qa='input_number_purchase_price_add_service_modal'
                            decimalSeparator=','
                            formatter={value => numeralFormatter(value)}
                            min={0}
                            onChange={value => {
                                elem.purchasePrice = value;
                                this.setState({});
                            }}
                            onStep={() => this.setState({})}
                            parser={value => numeralParser(value)}
                            precision={2}
                            value={data || 0}
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
                render: (data, elem) => {
                    return (
                        <InputNumber
                            className={Styles.serviceNumberInput}
                            data-qa='input_number_price_add_service_modal'
                            decimalSeparator=','
                            formatter={value => numeralFormatter(value)}
                            min={0}
                            onChange={value => {
                                elem.price = value;
                                elem.sum = value * elem.count;
                                this.setState({});
                            }}
                            onStep={() => this.setState({})}
                            parser={value => numeralParser(value)}
                            precision={2}
                            value={data || 0}
                        />
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.count' />,
                key: 'count',
                dataIndex: 'count',
                render: (data, elem) => {
                    const value = data ? Number(data).toFixed(2) : 0;

                    return (
                        <InputNumber
                            className={Styles.serviceNumberInput}
                            data-qa='input_number_count_add_service_modal'
                            decimalSeparator=','
                            formatter={value => numeralFormatter(value)}
                            min={0}
                            onChange={value => {
                                elem.count = value;
                                elem.sum = value * elem.price;
                                this.setState({});
                            }}
                            onStep={() => this.setState({})}
                            parser={value => numeralParser(value)}
                            step={0.1}
                            value={value}
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
                align: 'right',
                width: '5%',
                render: (data, elem) => {
                    const currentServiceOption = this.servicesOptions.find(labor => labor.id == data);

                    const defaultUse = _.get(
                        this.props.unitDefault.filter(({ defaultUse }) => defaultUse),
                        '[0].id'
                    );

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
                            getPopupContainer={() => document.querySelector('.addLaborModal')}
                            onChange={(value, option) => {
                                elem.laborUnitId = value;

                                this.setState({});
                            }}
                            placeholder={this.props.intl.formatMessage({
                                id: 'services_table.units_placeholder'
                            })}
                            showAction={['focus', 'click']}
                            showSearch
                            style={{ width: 100, color: 'var(--text)' }}
                            value={elem.laborUnitId || defaultUse}
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
                title: <FormattedMessage id='services_table.norm_hours' />,
                key: 'hours',
                dataIndex: 'hours',
                render: (data, elem) => {
                    return (
                        <Tooltip title={<FormattedMessage id='labors_table.check_labor_hours' />} zIndex={2001}>
                            <Button
                                data-qa='button_hours_add_service_modal'
                                onClick={() => {
                                    this.props.setModal(MODALS.NORM_HOURS_MODAL, {
                                        storeGroupId: elem.storeGroupId,
                                        laborId: elem.laborId,

                                        onSelect: ({ hours, storeGroupId, normHourPrice, price }) => {
                                            elem.hours = hours;
                                            elem.count = hours * this.props.laborTimeMultiplier;
                                            elem.storeGroupId = elem.storeGroupId || storeGroupId;
                                            elem.price = price || elem.price || normHourPrice;
                                            this.setState({});
                                        }
                                    });
                                }}
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
                render: elem => {
                    const sum = elem.price * (elem.count || 1);

                    return (
                        <InputNumber
                            className={Styles.serviceNumberInput}
                            data-qa='input_number_sum_add_service_modal'
                            decimalSeparator=','
                            disabled
                            formatter={value => numeralFormatter(value)}
                            parser={value => numeralParser(value)}
                            style={{ color: 'black' }}
                            value={Math.round(sum * 10) / 10 || 1}
                        />
                    );
                }
            },
            {
                key: 'delete',
                render: elem => {
                    return (
                        <CloseOutlined
                            onClick={() => {
                                elem.storeGroupId = this.state.editing || elem.related ? elem.storeGroupId : undefined;
                                elem.masterLaborId =
                                    this.state.editing || elem.related ? elem.masterLaborId : undefined;
                                elem.serviceName = undefined;
                                elem.comment = undefined;
                                elem.purchasePrice = 0;
                                elem.price = 1;
                                elem.count = 1;
                                elem.hours = 0;
                                elem.sum = undefined;
                                this.setState({});
                            }}
                        />
                    );
                }
            }
        ];
    }

    componentDidMount() {
        this.fetchData();
    }

    componentDidUpdate(prevProps, prevState) {
        const { visible, labor, labors } = this.props;
        const editing = Boolean(labor && labor.id);
        if (labors.length && !this.servicesOptions.length) {
            this.servicesOptions = [...labors];
            this.setState({});
        }
        if (prevProps.visible == false && visible) {
            this.getOptions();
            this.state.mainTableSource = [{ ...labor }];
            if (!editing) {
                this.state.mainTableSource[0].employeeId = this.props.defaultEmployeeId;
                this.state.mainTableSource[0].counterparty = 'EMPLOYEE';
            }

            this.setState({
                editing
            });
        }
    }

    handleOk = () => {
        const { editing, mainTableSource, relatedServices, relatedServicesCheckbox, relatedDetailCheckbox } =
            this.state;

        if (mainTableSource[0].laborId === undefined) {
            notification.warning({
                message: 'Заполните все необходимые поля!'
            });

            return;
        }
        if (editing) {
            this.props.updateLabor(this.props.tableKey, { ...mainTableSource[0] });
        } else {
            const defaultUse = _.get(
                this.props.unitDefault.filter(({ defaultUse }) => defaultUse),
                '[0].id'
            );
            const data = {
                insertMode: true,
                details: [],
                services: []
            };
            mainTableSource.map(element => {
                data.services.push({
                    serviceId: element.laborId,
                    laborUnitId: element.laborUnitId || defaultUse,
                    serviceName: element.serviceName,
                    counterparty: element.counterparty,
                    employeeId: element.employeeId || null,
                    businessSupplierId: element.businessSupplierId || null,
                    serviceHours: element.hours || 0,
                    purchasePrice: Math.round(element.purchasePrice * 100) / 100 || 0,
                    count: element.count || 0,
                    servicePrice: Math.round(element.price * 100) / 100 || 0,
                    comment: element.comment || {
                        comment: undefined,
                        positions: []
                    },
                    specificationId: Number(element.specificationId || 0) || undefined
                });
            });
            if (relatedServicesCheckbox) {
                relatedServices.map(element => {
                    if (element.checked) {
                        data.services.push({
                            serviceId: element.laborId,
                            laborUnitId: element.laborUnitId || defaultUse,
                            serviceName: element.serviceName,
                            counterparty: element.counterparty,
                            employeeId: element.employeeId || null,
                            businessSupplierId: element.businessSupplierId || null,
                            serviceHours: element.hours || 0,
                            purchasePrice: Math.round(element.purchasePrice * 100) / 100 || 0,
                            count: element.count || 0,
                            servicePrice: Math.round(element.price * 100) / 100 || 0,
                            comment: element.comment || {
                                comment: undefined,
                                positions: []
                            }
                        });
                    }
                });
            }
            if (relatedDetailCheckbox) {
                data.details.push({
                    storeGroupId: mainTableSource[0].storeGroupId
                });
                data.modificationId = this.props.tecdocId || undefined;
            }
            this.addDetailsAndLabors(data);
        }
        this.props.hideModal();
    };

    handleCancel = () => {
        this.setState({
            mainTableSource: [],
            relatedServices: [],
            relatedServicesCheckbox: false
        });
        this.props.hideModal();
    };

    async getRelatedLabors(laborId) {
        const token = localStorage.getItem('_my.carbook.pro_token');
        const url = `${__API_URL__}/labors/related?id=${laborId}`;
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: token,
                    'Content-Type': 'application/json'
                }
            });
            const result = await response.json();
            if (result.labors && result.labors.length) {
                this.setState({
                    relatedServices: result.labors[0].relatedLabors.map(labor => {
                        return {
                            ...labor,
                            laborId: labor.id,
                            related: true,
                            serviceName: labor.name,
                            storeGroupId: labor.storeGroupId,
                            customName: labor.customName,
                            count: labor.laborPrice.normHours || 1,
                            price: labor.laborPrice.price || 300,
                            employeeId: this.props.defaultEmployeeId,
                            counterparty: 'EMPLOYEE',
                            comment: {
                                comment: undefined,
                                positions: [],
                                problems: []
                            },
                            checked: true
                        };
                    })
                });
            }
        } catch (error) {
            console.error('ERROR:', error);
        }
    }

    async addDetailsAndLabors(data) {
        const { status } = await fetchAPI('GET', 'orders/status', { orderId: this.props.orderId }, null);
        if (status === 'success') {
            window.location.reload();

            return;
        }
        const token = localStorage.getItem('_my.carbook.pro_token');
        const url = `${__API_URL__}/orders/${this.props.orderId}`;
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
            if (result.success) {
                this.props.updateDataSource();
            } else {
                console.log('BAD', result);
            }
        } catch (error) {
            console.error('ERROR:', error);
        }
    }

    fetchData() {
        this.masterLabors = this.props.masterLabors;
        this.labors = this.props.labors;
        this.storeGroups = this.props.details;
        this.getOptions();
    }

    getOptions() {
        this.servicesOptions = [...this.props.labors];
        this.employeeOptions = this.props.employees.map((elem, i) => (
            <Option key={i} value={elem.id}>
                {elem.name} {elem.surname}
            </Option>
        ));
    }

    filterOptions(masterLaborId, storeGroupId, laborId) {
        let servicesOptions = [...this.props.labors];
        if (masterLaborId) {
            servicesOptions = servicesOptions.filter((elem, index) => elem.masterLaborId == masterLaborId);
        }
        if (storeGroupId) {
            servicesOptions = servicesOptions.filter((elem, index) => elem.storeGroupId == storeGroupId);
        }
        if (laborId) {
            servicesOptions = servicesOptions.filter((elem, index) => elem.id == laborId);
        }

        this.servicesOptions = [...servicesOptions];
    }

    deleteService = async () => {
        const token = localStorage.getItem('_my.carbook.pro_token');
        let url = __API_URL__;
        const params = `/orders/${this.props.orderId}/labors?ids=[${this.props.labor.id}]`;
        url += params;
        try {
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    Authorization: token,
                    'Content-Type': 'application/json'
                }
            });
            const result = await response.json();
            if (result.success) {
                this.props.updateDataSource();
                this.handleCancel();
            } else {
                console.log('BAD', result);
            }
        } catch (error) {
            console.error('ERROR:', error);
        }
    };

    confirmDelete = () => {
        const { formatMessage } = this.props.intl;
        const that = this;
        confirm({
            title: formatMessage({ id: 'add_order_form.delete_confirm' }),
            onOk() {
                that.deleteService();
            },
            okType: 'danger'
        });
    };

    getMobileForm() {
        const { mainTableSource } = this.state;
        const dataSource = mainTableSource[0] || {};
        const columns = this.columns();
        columns.pop();

        return columns.map(({ title, key, render, dataIndex }) => {
            if (key == 'purchasePrice' || key == 'hours' || key == 'comment' || key == 'laborUnitId') {
                return;
            }

            return (
                <div
                    key={key}
                    className={`${Styles.mobileTable} ${
                        (key == 'price' || key == 'count') && Styles.mobileTableNumber
                    } ${key == 'employee' && Styles.mobileTableEmployee} ${
                        key == 'comment' && Styles.mobileTableComment
                    } ${key == 'sum' && Styles.mobileTableSum} `}
                >
                    {key != 'comment' && title}
                    <div>{dataIndex ? render(dataSource[dataIndex], dataSource) : render(dataSource)}</div>
                </div>
            );
        });
    }

    render() {
        const { visible, isMobile, unitDefault } = this.props;
        const { relatedServicesCheckbox, mainTableSource, relatedServices, editing, relatedDetailCheckbox } =
            this.state;

        const columns = this.columns();

        return (
            <React.Fragment>
                <Modal
                    footer={
                        isMobile && editing ? (
                            <div>
                                <Button
                                    data-qa='button_confirm_delete_add_service_modal'
                                    onClick={() => this.confirmDelete()}
                                    style={{
                                        float: 'left'
                                    }}
                                    type='danger'
                                >
                                    <DeleteOutlined />
                                </Button>
                                <Button
                                    data-qa='button_handle_cancel_add_service_modal'
                                    onClick={() => this.handleCancel()}
                                >
                                    <FormattedMessage id='cancel' />
                                </Button>
                                <Button
                                    data-qa='button_handle_ok_add_service_modal'
                                    onClick={() => this.handleOk()}
                                    type='primary'
                                >
                                    <FormattedMessage id='save' />
                                </Button>
                            </div>
                        ) : (
                            void 0
                        )
                    }
                    forceRender
                    maskClosable={false}
                    onCancel={this.handleCancel}
                    onOk={this.handleOk}
                    title={<FormattedMessage id='add_labor' />}
                    visible={visible}
                    width='95%'
                    wrapClassName='addLaborModal'
                >
                    <div className={Styles.tableWrap}>
                        {!isMobile ? (
                            <Table
                                bordered
                                columns={columns.slice(1)}
                                dataSource={mainTableSource}
                                pagination={false}
                                size='small'
                            />
                        ) : (
                            this.getMobileForm()
                        )}
                    </div>
                    {!isMobile && (
                        <div>
                            <FormattedMessage id='add_order_form.related' />
                            :
                            <FormattedMessage id='add_order_form.services' />
                            <Checkbox
                                checked={relatedServicesCheckbox}
                                data-qa='checkbox_related_services_add_service_modal'
                                disabled={editing}
                                onChange={() => {
                                    this.setState({
                                        relatedServicesCheckbox: !relatedServicesCheckbox
                                    });
                                }}
                                style={{ marginLeft: 5, marginRight: 14 }}
                            />
                            <FormattedMessage id='add_order_form.details' />
                            <Checkbox
                                checked={relatedDetailCheckbox}
                                disabled={editing}
                                onChange={() => {
                                    this.setState({
                                        relatedDetailCheckbox: !relatedDetailCheckbox
                                    });
                                    localStorage.setItem('_my.carbook.relatedDetailCheckbox', !relatedDetailCheckbox);
                                }}
                                style={{ marginLeft: 5 }}
                            />
                            {relatedServicesCheckbox && (
                                <div className={Styles.tableWrap}>
                                    <Table
                                        bordered
                                        columns={columns}
                                        dataSource={relatedServices}
                                        pagination={false}
                                        rowKey='laborId'
                                        size='small'
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </Modal>
            </React.Fragment>
        );
    }
}
export default AddServiceModal;

@injectIntl
class CommentaryButton extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            loading: false,
            visible: false,
            currentCommentaryProps: {
                name: props.detail,
                positions: [],
                problems: []
            },
            currentCommentary: undefined
        };
        this.commentaryInput = React.createRef();
        this.positions = [
            'front_axle',
            'ahead',
            'overhead',
            'rear_axle',
            'behind',
            'down_below',
            'Right_wheel',
            'on_right',
            'outside',
            'left_wheel',
            'left',
            'inside',
            'lever_arm',
            'at_both_sides',
            'centered'
        ];
        this._isMounted = false;
    }

    showModal = () => {
        this.setState({
            currentCommentary: this.props.commentary.comment ? this.props.commentary.comment : this.props.detail,
            visible: true
        });
        if (this.commentaryInput.current !== undefined) {
            this.commentaryInput.current.focus();
        }

        if (!this.props.commentary.comment) {
            this.setState({
                currentCommentaryProps: {
                    name: this.props.detail,
                    positions: [],
                    problems: []
                }
            });
        }
    };

    handleOk = async () => {
        const { currentCommentary, currentCommentaryProps } = this.state;
        this.setState({
            loading: true
        });
        this.props.setComment(currentCommentary, currentCommentaryProps.positions, currentCommentaryProps.problems);
        setTimeout(() => {
            this.setState({ loading: false, visible: false });
        }, 500);
    };

    handleCancel = () => {
        this.setState({
            visible: false,
            currentCommentary: this.props.detail,
            currentCommentaryProps: {
                name: this.props.detail,
                positions: [],
                problems: []
            }
        });
    };

    renderHeader = () => {
        return (
            <div>
                <p>{this.props.detail}</p>
            </div>
        );
    };

    getCommentary() {
        const { currentCommentaryProps } = this.state;
        let currentCommentary = this.props.detail;

        if (currentCommentaryProps.positions.length) {
            currentCommentary += ' -';
            currentCommentary += `${currentCommentaryProps.positions.map(
                data => ` ${this.props.intl.formatMessage({ id: data }).toLowerCase()}`
            )};`;
        }
        this.setState({
            currentCommentary
        });
    }

    setCommentaryPosition(position) {
        const { currentCommentaryProps } = this.state;
        const positionIndex = currentCommentaryProps.positions.indexOf(position);
        if (positionIndex == -1) {
            currentCommentaryProps.positions.push(position);
        } else {
            currentCommentaryProps.positions = currentCommentaryProps.positions.filter(
                (value, index) => index != positionIndex
            );
        }
        this.getCommentary();
    }

    componentDidMount() {
        this._isMounted = true;
        const { commentary, detail } = this.props;
        if (this._isMounted) {
            this.setState({
                currentCommentaryProps: {
                    name: detail,
                    positions: commentary.positions || [],
                    problems: commentary.problems || []
                }
            });
        }
    }

    componentWillUnmount() {
        this._isMounted = false;
    }

    render() {
        const { TextArea } = Input;
        const { visible, loading, currentCommentaryProps, currentCommentary } = this.state;
        const { disabled, commentary } = this.props;
        const { positions } = this;

        return (
            <div>
                {commentary.comment ? (
                    <Button
                        className={Styles.commentaryButton}
                        data-qa='button_commentary_edit_add_service_modal'
                        onClick={this.showModal}
                        title={this.props.intl.formatMessage({ id: 'commentary.edit' })}
                        type='primary'
                    >
                        <FormOutlined className={Styles.commentaryButtonIcon} />
                    </Button>
                ) : (
                    <Tooltip title={<FormattedMessage id='commentary.add' />} zIndex={2001}>
                        <Button
                            data-qa='button_commentary_add_add_service_modal'
                            disabled={disabled}
                            onClick={this.showModal}
                        >
                            <MessageOutlined />
                        </Button>
                    </Tooltip>
                )}
                <Modal
                    footer={
                        disabled
                            ? null
                            : [
                                  <Button
                                      key='back'
                                      data-qa='button_handle_cancel_commentary_button_add_service_modal'
                                      onClick={this.handleCancel}
                                  >
                                      <FormattedMessage id='cancel' />
                                  </Button>,
                                  <Button
                                      key='submit'
                                      data-qa='button_handle_ok_commentary_button_add_service_modal'
                                      loading={loading}
                                      onClick={this.handleOk}
                                      type='primary'
                                  >
                                      <FormattedMessage id='save' />
                                  </Button>
                              ]
                    }
                    maskClosable={false}
                    onCancel={this.handleCancel}
                    onOk={this.handleOk}
                    title={this.renderHeader()}
                    visible={visible}
                >
                    <React.Fragment>
                        <div className={Styles.commentaryVehicleSchemeWrap}>
                            <p className={Styles.commentarySectionHeader}>
                                <FormattedMessage id='commentary_modal.where' />?
                            </p>
                            <div className={Styles.blockButtonsWrap}>
                                {positions.map((position, key) => {
                                    return (
                                        <Button
                                            key={key}
                                            className={Styles.commentaryBlockButton}
                                            data-qa='button_set_comementary_block_commentary_button_add_service_modal'
                                            onClick={() => {
                                                this.setCommentaryPosition(position);
                                            }}
                                            type={
                                                currentCommentaryProps.positions.findIndex(elem => position == elem) ===
                                                -1
                                                    ? 'default'
                                                    : 'primary'
                                            }
                                        >
                                            <FormattedMessage id={position} />
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>
                        <div>
                            <p className={Styles.commentarySectionHeader}>
                                <FormattedMessage id='order_form_table.diagnostic.commentary' />
                            </p>
                            <TextArea
                                ref={this.commentaryInput}
                                autoFocus
                                data-qa='text_area_current_commentary_button_add_service_modal'
                                disabled={disabled}
                                onChange={() => {
                                    this.setState({
                                        currentCommentary: event.target.value
                                    });
                                }}
                                placeholder={`${this.props.intl.formatMessage({
                                    id: 'comment'
                                })}...`}
                                style={{ width: '100%', minHeight: '150px', resize: 'none' }}
                                value={currentCommentary}
                            />
                        </div>
                    </React.Fragment>
                </Modal>
            </div>
        );
    }
}
