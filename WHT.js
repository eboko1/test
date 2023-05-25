/* eslint-disable max-classes-per-file */
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    QuestionCircleOutlined
} from '@ant-design/icons';
import { Button, Dropdown, Input, InputNumber, Menu, Select, Table, notification } from 'antd';
import { Catcher } from 'commons';
import React, { Component } from 'react';
import { FormattedMessage, injectIntl } from 'react-intl';
import { isForbidden, permissions } from 'utils';
import Styles from './styles.m.css';

const { Option } = Select;

const INACTIVE = 'INACTIVE';
const IN_PROGRESS = 'IN_PROGRESS';
const STOPPED = 'STOPPED';
const DONE = 'DONE';
const CANCELED = 'CANCELED';
const ALL = 'ALL';
const stageArr = [INACTIVE, IN_PROGRESS, STOPPED, DONE, CANCELED];

@injectIntl
export default class WorkshopTable extends Component {
    constructor(props) {
        super(props);

        this.state = {
            loading: false,
            dataSource: [],
            stageFilter: undefined,
            fieldsFilter: undefined,
            selectedRows: []
        };

        this.columns = [
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
                dataIndex: 'serviceName'
            },
            {
                title: <FormattedMessage id='order_form_table.calculation' />,
                key: 'count',
                dataIndex: 'count',
                render: data => {
                    return (
                        <span>
                            {data || 0} <FormattedMessage id='order_form_table.hours_short' />
                        </span>
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.workingTime' />,
                key: 'workingTime',
                dataIndex: 'workingTime',
                render: data => {
                    return (
                        <span>
                            {data ? Math.abs(data.toFixed(2)) : 0}{' '}
                            <FormattedMessage id='order_form_table.hours_short' />
                        </span>
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.stoppedTime' />,
                key: 'stoppedTime',
                dataIndex: 'stoppedTime',
                render: data => {
                    return (
                        <span>
                            <span style={{ fontWeight: 700 }}>
                                {data ? Math.abs(data.toFixed(2)) : 0}
                            </span>{' '}
                            <FormattedMessage id='order_form_table.hours_short' />
                        </span>
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.PD' />,
                key: 'agreement',
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

                    return isForbidden(
                        this.props.user,
                        permissions.ACCESS_ORDER_DETAILS_CHANGE_STATUS
                    ) ? (
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
                            <Dropdown overlay={menu}>
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
            },
            {
                title: <FormattedMessage id='order_form_table.status' />,
                key: 'stage',
                dataIndex: 'stage',
                render: data => {
                    return <FormattedMessage id={`workshop_table.${data}`} />;
                }
            },
            {
                title: (
                    <LaborStageButtonsGroup
                        disabled={isForbidden(
                            this.props.user,
                            permissions.ACCESS_ORDER_TABS_WORKSHOP_BUTTONS
                        )}
                        onClick={value => {
                            this.multipleChangeState(value);
                        }}
                        stage={ALL}
                    />
                ),
                key: 'actions',
                dataIndex: 'stage',
                width: 'fit-content',
                render: (stage, elem) => {
                    return (
                        <LaborStageButtonsGroup
                            disabled={isForbidden(
                                this.props.user,
                                permissions.ACCESS_ORDER_TABS_WORKSHOP_BUTTONS
                            )}
                            onClick={value => {
                                elem.stage = value;
                                this.updateLabor(elem.key, elem);
                            }}
                            stage={stage}
                        />
                    );
                }
            }
        ];

        this.mobileColumns = [
            {
                title: <FormattedMessage id='order_form_table.detail_name' />,
                key: 'serviceName',
                dataIndex: 'serviceName'
            },
            {
                title: (
                    <div>
                        <p>
                            <FormattedMessage id='order_form_table.calculation' />
                        </p>
                        <p>
                            <FormattedMessage id='order_form_table.workingTime' />
                        </p>
                        <p>
                            <FormattedMessage id='order_form_table.stoppedTime' />
                        </p>
                    </div>
                ),
                key: 'count',
                dataIndex: 'count',
                render: (data, row) => {
                    return (
                        <div>
                            <p>
                                {data || 0} <FormattedMessage id='order_form_table.hours_short' />
                            </p>
                            <p>
                                {row.workingTime ? Math.abs(row.workingTime.toFixed(2)) : 0}{' '}
                                <FormattedMessage id='order_form_table.hours_short' />
                            </p>
                            <span style={{ fontWeight: 700 }}>
                                {row.stoppedTime ? Math.abs(row.stoppedTime.toFixed(2)) : 0}
                            </span>{' '}
                            <FormattedMessage id='order_form_table.hours_short' />
                        </div>
                    );
                }
            },
            {
                title: <FormattedMessage id='order_form_table.stage' />,
                key: 'stage',
                dataIndex: 'stage',
                render: data => {
                    return `${this.props.intl
                        .formatMessage({ id: `workshop_table.${data}` })
                        .substring(0, 5)}.`;
                }
            },
            {
                key: 'actions',
                dataIndex: 'stage',
                render: (stage, elem) => {
                    return (
                        <LaborStageButtonsGroup
                            buttonStyle={{ width: '100%', margin: '1px 0' }}
                            disabled={isForbidden(
                                this.props.user,
                                permissions.ACCESS_ORDER_TABS_WORKSHOP_BUTTONS
                            )}
                            isMobile
                            onClick={value => {
                                elem.stage = value;
                                this.updateLabor(elem.key, elem);
                            }}
                            stage={stage}
                        />
                    );
                }
            }
        ];
    }

    async multipleChangeState(value) {
        const { selectedRows, dataSource } = this.state;
        const data = {
            updateMode: true,
            services: []
        };

        selectedRows.map(key => {
            dataSource[key].stage == value;
            data.services.push({
                id: dataSource[key].id,
                stage: value
            });
        });

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
            } else {
                console.log('BAD', result);
            }
            this.updateDataSource();
        } catch (error) {
            console.error('ERROR:', error);
            this.updateDataSource();
        }
    }

    async updateDataSource() {
        const callback = data => {
            data.orderServices.map((elem, index) => {
                elem.key = index;
            });
            this.setState({
                dataSource: data.orderServices,
                fetched: true
            });
        };
        if (this.props.reloadOrderForm) this.props.reloadOrderForm(callback, 'labors', true);
        else {
            const token = localStorage.getItem('_my.carbook.pro_token');
            const url = `${__API_URL__}/orders/${this.props.orderId}/labors`;
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        Authorization: token,
                        'Content-Type': 'application/json'
                    }
                });
                const result = await response.json();
                this.setState({
                    dataSource: result.labors
                });
            } catch (error) {
                console.error('ERROR:', error);
            }
        }
    }

    async updateLabor(key, labor) {
        this.state.dataSource[key] = labor;
        console.log('laborlabor', labor)
        const data = {
            updateMode: true,
            services: [
                {
                    id: labor.id,
                    laborId: labor.laborId,
                    stage: labor.stage
                }
            ]
        };

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
            } else {
                console.log('BAD', result);
            }
            this.updateDataSource();
        } catch (error) {
            console.error('ERROR:', error);
            this.updateDataSource();
        }
    }

    sendSms() {
        const that = this;
        const token = localStorage.getItem('_my.carbook.pro_token');
        const url = `${__API_URL__}/orders/${this.props.orderId}/send_message?type=finish_labors`;
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
                notification.success({
                    message: that.props.intl.formatMessage({
                        id: 'message_sent'
                    })
                });
            })
            .catch(function (error) {
                // eslint-disable-next-line no-console
                console.log('error', error);
            });
    }

    componentDidMount() {
        const tmp = [...this.props.orderServices];
        tmp.map((elem, i) => (elem.key = i));
        this.setState({
            dataSource: tmp
        });
    }

    componentDidUpdate(prevProps) {
        if (prevProps.activeKey != 'workshop' && this.props.activeKey == 'workshop') {
            let tmp = [...this.props.orderServices];
            tmp = tmp.filter(elem => elem.id);
            tmp.map((elem, i) => (elem.key = i));
            this.setState({
                dataSource: tmp,
                stageFilter: undefined,
                fieldsFilter: undefined,
                selectedRows: []
            });
        }
    }

    render() {
        const { dataSource, loading, fieldsFilter, stageFilter } = this.state;
        const { isMobile, user } = this.props;
        let calcTime = 0;
        let realTime = 0;
        const stoppedTime = 0;
        dataSource.map(elem => {
            if (elem.count) calcTime += elem.count;
            if (elem.workingTime) realTime += elem.workingTime;
            if (elem.stoppedTime) calcTime += elem.stoppedTime;
        });

        let filteredData = [...dataSource];
        filteredData = filteredData.filter(elem => elem.agreement != 'REJECTED');
        if (fieldsFilter) {
            filteredData = dataSource.filter(
                elem =>
                    String(elem.serviceName).toLowerCase().includes(fieldsFilter.toLowerCase()) ||
                    String(elem.defaultName).toLowerCase().includes(fieldsFilter.toLowerCase())
            );
        }

        if (stageFilter) {
            filteredData = dataSource.filter(elem => elem.stage == stageFilter);
        }

        const rowSelection = {
            onChange: (selectedRowKeys, selectedRows) => {
                this.setState({
                    selectedRows: selectedRowKeys
                });
            }
        };

        return (
            <Catcher>
                {!isMobile && (
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            margin: '12px 0'
                        }}
                    >
                        <div style={{ width: '70%' }}>
                            <Input
                                data-qa='input_fields_filter_workshop_table_order_page'
                                allowClear
                                onChange={({ target: { value } }) => {
                                    this.setState({
                                        fieldsFilter: value
                                    });
                                }}
                                placeholder={this.props.intl.formatMessage({
                                    id: 'order_form_table.fields_filter'
                                })}
                            />
                        </div>
                        <div style={{ width: '20%' }}>
                            <Select
                                data-qa='select_stage_filter_workshop_table_order_page'
                                allowClear
                                onChange={value => {
                                    this.setState({
                                        stageFilter: value
                                    });
                                }}
                                placeholder={this.props.intl.formatMessage({
                                    id: 'order_form_table.stage'
                                })}
                                showSearch
                            >
                                {stageArr.map((value, key) => {
                                    return (
                                        <Option key={key} value={value}>
                                            <FormattedMessage id={`workshop_table.${value}`} />
                                        </Option>
                                    );
                                })}
                            </Select>
                        </div>
                        <div>
                            <Button
                                data-qa='btn_send_sms_workshop_table_order_page'
                                disabled={isForbidden(
                                    user,
                                    permissions.ACCESS_ORDER_TABS_WORKSHOP_FINISH
                                )}
                                onClick={() => {
                                    this.sendSms();
                                }}
                                type='primary'
                            >
                                <FormattedMessage id='end' />
                            </Button>
                        </div>
                    </div>
                )}
                <Table
                    bordered
                    columns={isMobile ? this.mobileColumns : this.columns}
                    dataSource={filteredData}
                    loading={loading}
                    pagination={false}
                    rowClassName={record => {
                        const { stage } = record;

                        return Styles[stage];
                    }}
                    rowSelection={isMobile ? null : rowSelection}
                    size='small'
                    style={isMobile ? {} : { overflowX: 'scroll' }}
                />
                <div
                    style={
                        isMobile
                            ? {
                                  textAlign: 'end',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  margin: '8px 0 0 0'
                              }
                            : {
                                  textAlign: 'end'
                              }
                    }
                >
                    <span style={{ marginLeft: 24, fontWeight: 500 }}>
                        <FormattedMessage id='workshop_table.footer.calculationTime' />{' '}
                        <InputNumber
                            data-qa='input_calculationTime_workshop_table_order_page'
                            disabled
                            style={{ color: 'black', marginLeft: 6 }}
                            value={calcTime.toFixed(2)}
                        />
                    </span>
                    <span style={{ marginLeft: 24, fontWeight: 500 }}>
                        <FormattedMessage id='workshop_table.footer.realTime' />{' '}
                        <InputNumber
                            data-qa='input_realTime_workshop_table_order_page'
                            disabled
                            style={{ color: 'black', marginLeft: 6 }}
                            value={realTime.toFixed(2)}
                        />
                    </span>
                    <span style={{ marginLeft: 24, fontWeight: 500 }}>
                        <FormattedMessage id='workshop_table.footer.stoppedTime' />{' '}
                        <InputNumber
                            data-qa='input_stoppedTime_workshop_table_order_page'
                            disabled
                            style={{ color: 'black', marginLeft: 6 }}
                            value={stoppedTime.toFixed(2)}
                        />
                    </span>
                </div>
            </Catcher>
        );
    }
}

class LaborStageButtonsGroup extends Component {
    render() {
        const { stage, onClick, buttonStyle, isMobile, disabled } = this.props;

        return (
            <div
                className={Styles.laborStageButtonsGroup}
                style={!isMobile ? { display: 'flex' } : {}}
            >
                {stage == CANCELED || stage == DONE ? (
                    <Button
                        data-qa='btn_inactive_LaborStageButtonsGroup_workshop_table_order_page'
                        onClick={() => onClick(INACTIVE)}
                        style={{ width: '100%' }}
                        type='primary'
                    >
                        <FormattedMessage id='workshop_table.button.change' />
                    </Button>
                ) : (
                    <React.Fragment>
                        <Button
                            data-qa='btn_inprogress_LaborStageButtonsGroup_workshop_table_order_page'
                            className={Styles.greenButton}
                            disabled={
                                disabled ||
                                (stage != ALL && (stage == IN_PROGRESS || stage == CANCELED))
                            }
                            onClick={() => onClick(IN_PROGRESS)}
                            style={buttonStyle}
                        >
                            <FormattedMessage id='workshop_table.button.start' />
                        </Button>
                        <Button
                            data-qa='btn_done_LaborStageButtonsGroup_workshop_table_order_page'
                            className={Styles.greenButton}
                            disabled={
                                disabled ||
                                (stage != ALL &&
                                    (stage == INACTIVE || stage == DONE || stage == CANCELED))
                            }
                            onClick={() => onClick(DONE)}
                            style={buttonStyle}
                        >
                            <FormattedMessage id='workshop_table.button.finish' />
                        </Button>
                        <Button
                            data-qa='btn_stopped_LaborStageButtonsGroup_workshop_table_order_page'
                            className={Styles.redButton}
                            disabled={
                                disabled ||
                                (stage != ALL &&
                                    (stage == STOPPED || stage == DONE || stage == CANCELED))
                            }
                            onClick={() => onClick(STOPPED)}
                            style={buttonStyle}
                            type='danger'
                        >
                            <FormattedMessage id='workshop_table.button.stop' />
                        </Button>
                        <Button
                             data-qa='btn_cancel_LaborStageButtonsGroup_workshop_table_order_page'
                            className={Styles.yellowButton}
                            disabled={
                                disabled || (stage != ALL && (stage == DONE || stage == CANCELED))
                            }
                            onClick={() => onClick(CANCELED)}
                            style={buttonStyle}
                        >
                            <FormattedMessage id='workshop_table.button.cancel' />
                        </Button>
                    </React.Fragment>
                )}
            </div>
        );
    }
}
