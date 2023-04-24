'use strict';

module.exports = ({ proxyHandler }) => ({ 
  method: 'POST',
  path: '/store_products_into_order',
  options: {
    tags: ['api'],
    auth: 'jwt',
  },
  handler: proxyHandler('clients'),
});
