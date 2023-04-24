'use strict';

//vendor
const Joi = require('joi');
//own
const { ADMIN, UPDATE_SUCCESS_ORDER } = require('../../constants/grants');
const { CREATED } = require('../../constants/responses');

module.exports = ({ storeDocProductModel, storeDocModel }) => ({
  method: 'POST',
  path: '/store_products_into_order',
  options: {
    tags: ['api'],
    auth: { strategy: 'jwt', scope: [ADMIN, UPDATE_SUCCESS_ORDER] },
    validate: {
      payload: Joi.object({
        productIds: Joi.array().items(Joi.number()
          .integer()
          .min(1)
          .optional()),
        addAvailable: Joi.bool().default(false).optional(),
      }),
    },
  },
  handler: async request => {
    const {
      auth: {
        credentials: {
          manager: { businessId, id: managerId },
        },
      },
      payload
    } = request;

    const options = {
      businessId,
      ...payload,
    };

    const result = await storeDocModel.addProductsIntoOrder({...options});
    

    return result; 
  },
});
