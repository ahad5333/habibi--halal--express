const API_ENDPOINTS = {
  production: 'https://api.authorize.net/xml/v1/request.api',
  sandbox:    'https://apitest.authorize.net/xml/v1/request.api',
};

async function chargeCard({ opaqueData, amount, orderNumber, billingZip, apiLoginId, transactionKey, environment = 'production' }) {
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
        // ZIP-only AVS check -- we don't collect full billing street address,
        // just the ZIP, which is enough for Authorize.net to flag a
        // ZIP/card mismatch as a fraud signal without adding more fields.
        ...(billingZip ? { billTo: { zip: String(billingZip).slice(0, 10) } } : {}),
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

// ── CIM: vault a card by referencing an already-succeeded transaction ──────
// Accept.js opaque data tokens are single-use, so a card can't be charged
// and vaulted from the same tokenization -- this creates the customer/
// payment profile from the transaction that already completed, which needs
// no card data of its own.
async function createCustomerProfileFromTransaction({ transactionId, apiLoginId, transactionKey, environment = 'production' }) {
  const endpoint = API_ENDPOINTS[environment] || API_ENDPOINTS.production;

  const body = {
    createCustomerProfileFromTransactionRequest: {
      merchantAuthentication: { name: apiLoginId, transactionKey },
      transId: String(transactionId),
    },
  };

  const res  = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json();

  if (data.messages?.resultCode !== 'Ok') {
    const msg = data.messages?.message?.[0]?.text || 'Could not save card';
    throw new Error(msg);
  }

  const paymentProfileId = data.customerPaymentProfileIdList?.numericString?.[0];
  if (!data.customerProfileId || !paymentProfileId) {
    throw new Error('Authorize.net did not return a payment profile id');
  }

  return {
    customerProfileId:        data.customerProfileId,
    customerPaymentProfileId: paymentProfileId,
  };
}

// ── CIM: charge a previously-saved card (no card data passes through us) ──
async function chargeCustomerProfile({ customerProfileId, customerPaymentProfileId, amount, orderNumber, apiLoginId, transactionKey, environment = 'production' }) {
  const endpoint = API_ENDPOINTS[environment] || API_ENDPOINTS.production;

  const body = {
    createTransactionRequest: {
      merchantAuthentication: { name: apiLoginId, transactionKey },
      refId: String(orderNumber).slice(0, 20),
      transactionRequest: {
        transactionType: 'authCaptureTransaction',
        amount: parseFloat(amount).toFixed(2),
        profile: {
          customerProfileId,
          paymentProfile: { paymentProfileId: customerPaymentProfileId },
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

// ── CIM: remove a saved card from Authorize.net's vault ────────────────────
async function deleteCustomerPaymentProfile({ customerProfileId, customerPaymentProfileId, apiLoginId, transactionKey, environment = 'production' }) {
  const endpoint = API_ENDPOINTS[environment] || API_ENDPOINTS.production;

  const body = {
    deleteCustomerPaymentProfileRequest: {
      merchantAuthentication: { name: apiLoginId, transactionKey },
      customerProfileId,
      customerPaymentProfileId,
    },
  };

  const res  = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json();

  // "Ok" on success; treat "record not found" as a harmless no-op since our
  // local row is being deleted either way and there's nothing left to undo.
  if (data.messages?.resultCode !== 'Ok') {
    const alreadyGone = data.messages?.message?.some(m => /not found/i.test(m.text || ''));
    if (!alreadyGone) {
      throw new Error(data.messages?.message?.[0]?.text || 'Could not remove saved card');
    }
  }
}

module.exports = {
  chargeCard,
  refundTransaction,
  createCustomerProfileFromTransaction,
  chargeCustomerProfile,
  deleteCustomerPaymentProfile,
};
