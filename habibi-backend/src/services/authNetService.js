const API_ENDPOINTS = {
  production: 'https://api.authorize.net/xml/v1/request.api',
  sandbox:    'https://apitest.authorize.net/xml/v1/request.api',
};

async function chargeCard({ opaqueData, amount, orderNumber, apiLoginId, transactionKey, environment = 'production' }) {
  const endpoint = API_ENDPOINTS[environment] || API_ENDPOINTS.production;

  const body = {
    createTransactionRequest: {
      merchantAuthentication: { name: apiLoginId, transactionKey },
      refId: String(orderNumber).slice(0, 20),
      transactionRequest: {
        transactionType: 'authCaptureTransaction',
        amount: parseFloat(amount).toFixed(2),
        payment: {
          opaqueData: {
            dataDescriptor: opaqueData.dataDescriptor,
            dataValue:      opaqueData.dataValue,
          },
        },
        order: {
          invoiceNumber: String(orderNumber).slice(0, 20),
          description:   'Habibi Halal Express',
        },
      },
    },
  };

  const res  = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json();

  const txRes = data.transactionResponse;
  if (!txRes || txRes.responseCode !== '1') {
    const msg = txRes?.errors?.[0]?.errorText
      || data.messages?.message?.[0]?.text
      || 'Payment declined';
    throw new Error(msg);
  }

  return {
    transactionId: txRes.transId,
    authCode:      txRes.authCode,
  };
}

async function refundTransaction({ transactionId, amount, cardLastFour, apiLoginId, transactionKey, environment = 'production' }) {
  const endpoint = API_ENDPOINTS[environment] || API_ENDPOINTS.production;

  const body = {
    createTransactionRequest: {
      merchantAuthentication: { name: apiLoginId, transactionKey },
      transactionRequest: {
        transactionType: 'refundTransaction',
        amount: parseFloat(amount).toFixed(2),
        payment: {
          creditCard: {
            cardNumber:     cardLastFour || '0000',
            expirationDate: 'XXXX',
          },
        },
        refTransId: transactionId,
      },
    },
  };

  const res  = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json();

  const txRes = data.transactionResponse;
  if (!txRes || txRes.responseCode !== '1') {
    const msg = txRes?.errors?.[0]?.errorText
      || data.messages?.message?.[0]?.text
      || 'Refund failed';
    throw new Error(msg);
  }

  return { transactionId: txRes.transId };
}

module.exports = { chargeCard, refundTransaction };
