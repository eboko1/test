import { Form } from '@ant-design/compatible';
import { PhoneTwoTone } from '@ant-design/icons';
import { Col, notification, Row, Select } from 'antd';
import { ArrayInput } from 'components';
import dayjs from 'dayjs';
import {
    DecoratedDatePicker,
    DecoratedInput,
    DecoratedInputNumber,
    DecoratedSelect,
    DecoratedTextArea
} from 'forms/DecoratedFields';
import _ from 'lodash';
import React, { Component } from 'react';
import { FormattedMessage, injectIntl } from 'react-intl';
import { connect } from 'react-redux';
import Styles from './styles.m.css';

const openNotificationWithIcon = (type, message, description) => {
    notification[type]({
        message,
        description
    });
};

const mapStateToProps = state => ({
    user: state.auth
});

const { Option } = Select;

@injectIntl
@connect(mapStateToProps)
export class AbstractClientForm extends Component {
    constructor(props) {
        super(props);

        this.apiErrorsMap = {
            CLIENT_EXISTS: props.intl.formatMessage({
                id: 'add_client_form.client_exists_error'
            })
        };
    }

    render() {
        const {
            user,
            client,
            errors,
            searchQuery,
            isMobile,
            intl: { formatMessage }
        } = this.props;
        const { getFieldDecorator, getFieldValue, setFieldsValue } = this.props.form;
        console.log(getFieldValue('phones'));

        const searchQueryNumber = searchQuery ? searchQuery.replace(/\D+/g, '').slice(0, 12) : undefined;

        if (errors.length) {
            const currentComponentErrors = errors.filter(
                ({ response }) => _.keys(this.apiErrorsMap).includes(_.get(response, 'message'))
                // eslint-disable-next-line function-paren-newline
            );

            _.each(currentComponentErrors, componentError => {
                const description = this.apiErrorsMap[componentError.response.message];

                const errorTitle = formatMessage({
                    id: 'add_client_form.error_title'
                });

                openNotificationWithIcon('error', errorTitle, description);
                this.props.handleError(componentError.id);
            });
        }

        const type = getFieldValue('type');

        return (
            <Form className={Styles.form} layout='vertical'>
                {!isMobile ? (
                    <React.Fragment>
                        <Row gutter={24} type='flex'>
                            <Col span={8}>
                                <DecoratedInput
                                    field='name'
                                    formItem
                                    getFieldDecorator={getFieldDecorator}
                                    getPopupContainer={trigger => trigger.parentNode}
                                    hasFeedback
                                    initialValue={_.get(client, 'name')}
                                    label={<FormattedMessage id='add_client_form.name' />}
                                    rules={[
                                        {
                                            required: true,
                                            message: formatMessage({
                                                id: 'required_field'
                                            })
                                        }
                                    ]}
                                />
                            </Col>
                            <Col span={8}>
                                <DecoratedInput
                                    field='patronymic'
                                    formItem
                                    getFieldDecorator={getFieldDecorator}
                                    getPopupContainer={trigger => trigger.parentNode}
                                    initialValue={_.get(client, 'middleName')}
                                    label={<FormattedMessage id='add_client_form.patronymic' />}
                                />
                            </Col>
                            <Col span={8}>
                                <DecoratedInput
                                    field='surname'
                                    formItem
                                    getFieldDecorator={getFieldDecorator}
                                    getPopupContainer={trigger => trigger.parentNode}
                                    initialValue={_.get(client, 'surname')}
                                    label={<FormattedMessage id='add_client_form.surname' />}
                                />
                            </Col>
                        </Row>

                        <Row gutter={24} type='flex'>
                            <Col span={8}>
                                <DecoratedSelect
                                    field='type'
                                    formItem
                                    getFieldDecorator={getFieldDecorator}
                                    getPopupContainer={trigger => trigger.parentNode}
                                    hasFeedback
                                    initialValue={_.get(client, 'type')}
                                    label={<FormattedMessage id='add_client_form.type' />}
                                    optionLabel='title'
                                    options={[
                                        {
                                            id: 'PHYSICAL_PERSON',
                                            title: formatMessage({
                                                id: 'add_client_form.PHYSICAL_PERSON'
                                            })
                                        },
                                        {
                                            id: 'ENTREPRENEUR',
                                            title: formatMessage({
                                                id: 'add_client_form.ENTREPRENEUR'
                                            })
                                        },
                                        {
                                            id: 'LIMITED_LIABILITY_COMPANY',
                                            title: formatMessage({
                                                id: 'add_client_form.LIMITED_LIABILITY_COMPANY'
                                            })
                                        },
                                        {
                                            id: 'OTHER',
                                            title: formatMessage({
                                                id: 'add_client_form.OTHER'
                                            })
                                        }
                                    ]}
                                    optionValue='id'
                                />
                            </Col>
                            <Col span={8}>
                                <DecoratedSelect
                                    field='status'
                                    formItem
                                    getFieldDecorator={getFieldDecorator}
                                    getPopupContainer={trigger => trigger.parentNode}
                                    hasFeedback
                                    initialValue={_.get(client, 'status')}
                                    label={<FormattedMessage id='add_client_form.status' />}
                                    optionLabel='title'
                                    options={[
                                        {
                                            id: 'permanent',
                                            title: formatMessage({
                                                id: 'add_client_form.permanent'
                                            })
                                        },
                                        {
                                            id: 'premium',
                                            title: formatMessage({
                                                id: 'add_client_form.premium'
                                            })
                                        },
                                        {
                                            id: 'problematic',
                                            title: formatMessage({
                                                id: 'add_client_form.problematic'
                                            })
                                        },
                                        {
                                            id: 'closed',
                                            title: formatMessage({
                                                id: 'add_client_form.closed'
                                            })
                                        }
                                    ]}
                                    optionValue='id'
                                />
                            </Col>
                            <Col span={8}>
                                <DecoratedSelect
                                    field='sourceId'
                                    formItem
                                    getFieldDecorator={getFieldDecorator}
                                    getPopupContainer={trigger => trigger.parentNode}
                                    hasFeedback
                                    initialValue={_.get(client, 'source')}
                                    label={<FormattedMessage id='add_client_form.source' />}
                                    optionFilterProp='children'
                                    optionLabel='title'
                                    optionValue='id'
                                    showSearch
                                >
                                    {this.props.source
                                        .filter(
                                            (elem, index) =>
                                                this.props.source.findIndex(
                                                    item => item.sourceName === elem.sourceName
                                                ) === index
                                        )
                                        .map(({ id, sourceName }) => (
                                            <Option key={id} value={id}>
                                                {String(sourceName)}
                                            </Option>
                                        ))}
                                </DecoratedSelect>
                            </Col>
                        </Row>
                        <Row gutter={24} type='flex'>
                            {((type && type == 'PHYSICAL_PERSON') ||
                                (!type && _.get(client, 'type') == 'PHYSICAL_PERSON')) && (
                                <React.Fragment>
                                    <Col span={8}>
                                        <DecoratedSelect
                                            field='sex'
                                            formItem
                                            getFieldDecorator={getFieldDecorator}
                                            getPopupContainer={trigger => trigger.parentNode}
                                            hasFeedback
                                            initialValue={_.get(client, 'sex')}
                                            label={<FormattedMessage id='add_client_form.sex' />}
                                            optionLabel='title'
                                            options={[
                                                {
                                                    id: 'male',
                                                    title: formatMessage({
                                                        id: 'add_client_form.male'
                                                    })
                                                },
                                                {
                                                    id: 'femail',
                                                    title: formatMessage({
                                                        id: 'add_client_form.female'
                                                    })
                                                }
                                            ]}
                                            optionValue='id'
                                        />
                                    </Col>
                                    <Col span={8}>
                                        <DecoratedDatePicker
                                            cnStyles={Styles.datePicker}
                                            field='birthday'
                                            format='YYYY-MM-DD'
                                            formatMessage={formatMessage}
                                            formItem
                                            getCalendarContainer={trigger => trigger.parentNode}
                                            getFieldDecorator={getFieldDecorator}
                                            initialValue={
                                                _.get(client, 'birthday') ? dayjs(_.get(client, 'birthday')) : void 0
                                            }
                                            label={<FormattedMessage id='add_client_form.birthday' />}
                                            value={null}
                                        />
                                    </Col>
                                </React.Fragment>
                            )}
                            <Col span={8}>
                                <DecoratedTextArea
                                    autoSize={{ minRows: 2, maxRows: 6 }}
                                    field='comment'
                                    formItem
                                    getFieldDecorator={getFieldDecorator}
                                    initialValue={_.get(client, 'comment')}
                                    label={<FormattedMessage id='comment' />}
                                />
                            </Col>
                        </Row>
                        <Row gutter={24} type='flex'>
                            <Col span={8}>
                                <ArrayInput
                                    buttonText={<FormattedMessage id='add_client_form.add_phone' />}
                                    fieldName='phones'
                                    fieldTitle={phoneNumber => {
                                        return (
                                            <React.Fragment>
                                                <span className={Styles.phoneRequired}>*</span>
                                                <a className={Styles.link} href={`tel:${phoneNumber}`}>
                                                    <FormattedMessage id='add_client_form.phones' />
                                                    <PhoneTwoTone className={Styles.phoneIcon} />
                                                </a>
                                            </React.Fragment>
                                        );
                                    }}
                                    form={this.props.form}
                                    initialValue={
                                        _.get(client, 'phones')
                                            ? _.get(client, 'phones').filter(Boolean)
                                            : searchQueryNumber
                                            ? [
                                                  `${
                                                      searchQueryNumber.substring(0, user.phoneCode.length) !==
                                                      user.phoneCode
                                                          ? user.phoneCode
                                                          : ''
                                                  }${searchQueryNumber}`.replace('3800', '380')
                                              ]
                                            : void 0
                                    }
                                    phone
                                    rules={[
                                        {
                                            required: true,
                                            message: formatMessage({
                                                id: 'required_field'
                                            })
                                        }
                                    ]}
                                />
                            </Col>
                            <Col span={8}>
                                <ArrayInput
                                    buttonText={<FormattedMessage id='add_client_form.add_email' />}
                                    fieldName='emails'
                                    fieldTitle={<FormattedMessage id='add_client_form.emails' />}
                                    form={this.props.form}
                                    initialValue={
                                        _.get(client, 'emails')
                                            ? _.isArray(client.emails)
                                                ? _.get(client, 'emails').filter(Boolean)
                                                : void 0
                                            : void 0
                                    }
                                    rules={[
                                        {
                                            type: 'email'
                                        }
                                    ]}
                                />
                            </Col>
                            <Col span={8}>
                                <DecoratedInputNumber
                                    field='paymentRespite'
                                    formItem
                                    getFieldDecorator={getFieldDecorator}
                                    initialValue={_.get(client, 'paymentRespite', 0)}
                                    label={<FormattedMessage id='add_client_form.payment_respite' />}
                                    max={1000}
                                    min={0}
                                    rules={[
                                        {
                                            required: false
                                        }
                                    ]}
                                />
                            </Col>
                        </Row>
                    </React.Fragment>
                ) : (
                    <div>
                        <DecoratedInput
                            field='name'
                            formItem
                            getFieldDecorator={getFieldDecorator}
                            getPopupContainer={trigger => trigger.parentNode}
                            hasFeedback
                            initialValue={_.get(client, 'name')}
                            label={<FormattedMessage id='add_client_form.name' />}
                            rules={[
                                {
                                    required: true,
                                    message: this.props.intl.formatMessage({
                                        id: 'required_field'
                                    })
                                }
                            ]}
                        />
                        <DecoratedInput
                            field='surname'
                            formItem
                            getFieldDecorator={getFieldDecorator}
                            getPopupContainer={trigger => trigger.parentNode}
                            initialValue={_.get(client, 'surname')}
                            label={<FormattedMessage id='add_client_form.surname' />}
                        />
                        <ArrayInput
                            buttonText={<FormattedMessage id='add_client_form.add_phone' />}
                            fieldName='phones'
                            fieldTitle={<FormattedMessage id='add_client_form.phones' />}
                            form={this.props.form}
                            initialValue={_.get(client, 'phones') ? _.get(client, 'phones').filter(Boolean) : void 0}
                            phone
                            rules={[
                                {
                                    required: true,
                                    message: this.props.intl.formatMessage({
                                        id: 'required_field'
                                    })
                                }
                            ]}
                        />
                        <DecoratedTextArea
                            autoSize={{ minRows: 2, maxRows: 6 }}
                            field='comment'
                            formItem
                            getFieldDecorator={getFieldDecorator}
                            initialValue={_.get(client, 'comment')}
                            label={<FormattedMessage id='comment' />}
                        />
                    </div>
                )}
            </Form>
        );
    }
}
