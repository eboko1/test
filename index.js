import { Form } from '@ant-design/compatible';
import { Col, Input, InputNumber, Modal, Row, Select } from 'antd';
import _, { get } from 'lodash';
import React from 'react';
import { FormattedMessage, injectIntl } from 'react-intl';
import { connect } from 'react-redux';
import book from 'routes/book';
import { fetchAPI, goTo } from 'utils';

import Styles from './styles.m.css';

const mapStateToProps = state => ({
    user: state.auth,
    modalProps: state.modals.modalProps
});

const mapDispatchToProps = {};

const { Option } = Select;

@injectIntl
@connect(mapStateToProps, mapDispatchToProps)
export default class AddOrderFromDocumentModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            serviceCount: 4,
            servicesDiscount: 0,
            sum: 0,
            labors: []
        };
    }

    componentDidMount() {
        this.fetchLabors();
    }

    componentDidUpdate(prevProps) {
        if (!prevProps.visible && this.props.visible) {
            if (this.state.labors.length) {
                const lbr = this.state.labors.find(({ id }) => id === '85014010100');
                console.log(lbr);
                if (lbr) {
                    this.setState({
                        servicePrice: lbr.laborPrice.price,
                        serviceName:
                            lbr.customName ||
                            lbr.name ||
                            `${lbr.masterLaborName} ${lbr.storeGroupName}` ||
                            lbr.serviceId
                    });
                }
            }

            this.setState({
                clientId: this.props.counterpartOptionInfo.value,
                serviceId: '85014010100',
                serviceName: 'Зберігання шин',
                serviceCount: get(this.props, 'docProducts[0].quantity', 4),
                servicesDiscount: 0
            });
        }
    }

    fetchLabors = async () => {
        const { labors } = await fetchAPI('GET', 'labors', null, null, {
            handleErrorInternally: true
        });
        this.setState({
            labors,
            serviceId: '85014010100'
        });
    };

    onOk = async () => {
        const { user, id, updateDocument } = this.props;
        const {
            clientId,
            vehicleId,
            serviceId,
            serviceName,
            serviceCount,
            servicePrice,
            servicesDiscount,
            comment
        } = this.state;
        const orderFromDoc = await fetchAPI(
            'POST',
            '/orders/from_store_doc',
            null,

            {
                businessId: user.businessId,
                clientId,
                managerId: user.id,
                storeDocId: id,
                clientVehicleId: vehicleId,
                serviceId,
                serviceName,
                serviceCount,
                servicePrice,
                servicesDiscount,
                comment
            },
            { handleErrorInternally: true }
        );
        Modal.confirm({
            title: this.props.intl.formatMessage({
                id: 'add_order_from_doc'
            }),
            onOk: () => {
                goTo(`${book.order}/${orderFromDoc.created}`);
            },
            okType: 'default',
            onCancel: () => {
                updateDocument();
                this.onCancel();
            }
        });

        this.onCancel();
    };

    onCancel = () => {
        this.setState({
            vehicleId: undefined,
            serviceCount: undefined,
            servicePrice: undefined,
            servicesDiscount: undefined,
            comment: undefined,
            sum: undefined
        });
        this.props.hideModal();
    };

    render() {
        const {
            visible,
            intl: { formatMessage },
            counterpartOptionInfo,
            clientList,
            products
        } = this.props;

        const {
            serviceId,
            serviceCount,
            servicePrice,
            servicesDiscount,
            comment,
            clientId,
            vehicleId,
            labors,
            sum
        } = this.state;

        const currentClient = clientList.find(
            ({ clientId }) => clientId === counterpartOptionInfo.value
        );

        return (
            <div>
                <Modal
                    // okButtonProps={{
                    //     disabled: !servicePrice || !vehicleId
                    // }}
                    onCancel={this.onCancel}
                    onOk={this.onOk}
                    title={
                        <React.Fragment>
                            <FormattedMessage id='client_page.create_order' /> ?
                        </React.Fragment>
                    }
                    visible={visible}
                >
                    <Form>
                        <Row className={Styles.row}>
                            <Col span={5}>
                                <div className={Styles.colText}>
                                    <FormattedMessage id='storage_document.client' />
                                </div>
                            </Col>
                            <Col span={5}>
                                <Select
                                    disabled
                                    onChange={value => {
                                        this.setState({
                                            clientId: value
                                        });
                                    }}
                                    placeholder={this.props.intl.formatMessage({
                                        id: 'storage_document.client'
                                    })}
                                    style={{
                                        width: 300
                                    }}
                                    value={clientId}
                                >
                                    {clientList
                                        .filter(
                                            ({ clientId }) =>
                                                clientId === counterpartOptionInfo.value
                                        )
                                        .map(({ clientId, name, surname, phones }) => (
                                            <Option value={clientId}>
                                                {surname} {name}
                                                {phones[0]}
                                            </Option>
                                        ))}
                                </Select>
                            </Col>
                        </Row>
                        <Row className={Styles.row}>
                            <Col span={5}>
                                <div className={Styles.colText}>
                                    <FormattedMessage id='order_form_table.vehicle' />
                                </div>
                            </Col>
                            <Col span={5}>
                                <Select
                                    onChange={value => {
                                        this.setState({
                                            vehicleId: value
                                        });
                                    }}
                                    placeholder={this.props.intl.formatMessage({
                                        id: 'order_form_table.vehicle'
                                    })}
                                    style={{
                                        width: 300
                                    }}
                                    value={vehicleId}
                                >
                                    {_.get(currentClient, 'vehicles', []).map(
                                        ({ id, modification, make }) => (
                                            <Option value={id}>
                                                {make} {modification}
                                            </Option>
                                        )
                                    )}
                                </Select>
                            </Col>
                        </Row>
                        <Row className={Styles.row}>
                            <Col span={5}>
                                <div className={Styles.colText}>
                                    <FormattedMessage id='labor' />
                                </div>
                            </Col>
                            <Col span={5}>
                                <Select
                                    allowClear
                                    getPopupContainer={trigger => trigger.parentNode}
                                    onChange={async (serviceId, option) => {
                                        await this.setState({
                                            serviceId,
                                            serviceName:
                                                option.customName ||
                                                option.name ||
                                                `${option.masterLaborName} ${option.storeGroupName}` ||
                                                serviceId,
                                            servicePrice: option.laborPrice.price,
                                            sum: serviceCount * servicePrice
                                        });
                                    }}
                                    optionFilterProp='children'
                                    placeholder={this.props.intl.formatMessage({
                                        id: 'search'
                                    })}
                                    showSearch
                                    style={{ marginBottom: 8, display: 'block', width: 300 }}
                                    value={serviceId}
                                >
                                    {labors.map(
                                        ({
                                            id,
                                            customName,
                                            masterLaborName,
                                            storeGroupName,
                                            name,
                                            laborPrice
                                        }) => (
                                            <Option
                                                key={id}
                                                customName={customName}
                                                laborPrice={laborPrice}
                                                masterLaborName={masterLaborName}
                                                storeGroupName={storeGroupName}
                                                value={id}
                                            >
                                                {customName ||
                                                    name ||
                                                    `${(masterLaborName, storeGroupName)}` ||
                                                    id}
                                            </Option>
                                        )
                                    )}
                                </Select>
                            </Col>
                        </Row>

                        <Row className={Styles.row}>
                            <Col span={5}>
                                <div className={Styles.colText}>
                                    <FormattedMessage id='clients-page.quantity' />
                                </div>
                            </Col>
                            <Col span={5}>
                                <InputNumber
                                    decimalSeparator=','
                                    min={0.1}
                                    onChange={serviceCount => {
                                        this.setState({
                                            serviceCount,
                                            sum: serviceCount * servicePrice
                                        });
                                    }}
                                    placeholder={this.props.intl.formatMessage({
                                        id: 'clients-page.quantity'
                                    })}
                                    precision={1}
                                    step={0.1}
                                    style={{
                                        marginRight: 8
                                    }}
                                    value={serviceCount}
                                />
                            </Col>
                            <Col span={2}>
                                <div className={Styles.colText}>
                                    <FormattedMessage id='price' />
                                </div>
                            </Col>
                            <Col span={5}>
                                <InputNumber
                                    decimalSeparator=','
                                    min={0.1}
                                    onChange={servicePrice => {
                                        this.setState({
                                            servicePrice,
                                            sum: serviceCount * servicePrice
                                        });
                                    }}
                                    placeholder={this.props.intl.formatMessage({
                                        id: 'price'
                                    })}
                                    precision={2}
                                    step={0.1}
                                    value={servicePrice}
                                />
                            </Col>
                        </Row>
                        <Row className={Styles.row}>
                            <Col span={5}>
                                <div className={Styles.colText}>
                                    <FormattedMessage id='order_form_table.discount' />
                                </div>
                            </Col>
                            <Col span={5}>
                                <InputNumber
                                    decimalSeparator=','
                                    formatter={servicesDiscount => `${servicesDiscount}%`}
                                    max={100}
                                    min={0}
                                    onChange={servicesDiscount => {
                                        this.setState({
                                            servicesDiscount
                                        });
                                    }}
                                    placeholder={this.props.intl.formatMessage({
                                        id: 'order_form_table.discount'
                                    })}
                                    style={{
                                        marginRight: 8
                                    }}
                                    value={servicesDiscount}
                                />
                            </Col>
                            <Col span={2}>
                                <div className={Styles.colText}>
                                    <FormattedMessage id='sum' />
                                </div>
                            </Col>
                            <Col span={5}>
                                <InputNumber
                                    decimalSeparator=','
                                    disabled
                                    min={0.1}
                                    placeholder={this.props.intl.formatMessage({
                                        id: 'sum'
                                    })}
                                    precision={2}
                                    step={0.1}
                                    value={serviceCount * servicePrice || 0}
                                />
                            </Col>
                        </Row>
                        <Row className={Styles.row}>
                            <Col span={5}>
                                <div className={Styles.colText}>
                                    <FormattedMessage id='comment' />
                                </div>
                            </Col>
                            <Col span={5}>
                                <Input.TextArea
                                    onChange={event => {
                                        this.setState({
                                            comment: event.target.value
                                        });
                                    }}
                                    style={{
                                        width: 300,
                                        maxWidth: 300
                                    }}
                                    value={comment}
                                />
                            </Col>
                        </Row>
                    </Form>
                </Modal>
            </div>
        );
    }
}
