require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store');
        }
    }
}));

// Paystack configuration
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_VERIFY_URL = 'https://api.paystack.co/transaction/verify/';
const PAYSTACK_INITIALIZE_URL = 'https://api.paystack.co/transaction/initialize';

app.get('/api/config', (req, res) => {
    const paystackPublicKey = process.env.PAYSTACK_PUBLIC_KEY;

    if (!paystackPublicKey) {
        return res.status(500).json({
            status: false,
            message: 'PAYSTACK_PUBLIC_KEY is not set'
        });
    }

    res.json({
        status: true,
        paystackPublicKey
    });
});

app.post('/api/paystack/initialize', async (req, res) => {
    try {
        const { email, amount, currency, reference, metadata, callback_url } = req.body || {};

        if (!email) {
            return res.status(400).json({ status: false, message: 'Email is required' });
        }

        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ status: false, message: 'Amount is required and must be a positive number (in kobo/cents)' });
        }

        if (!PAYSTACK_SECRET_KEY) {
            return res.status(500).json({ status: false, message: 'PAYSTACK_SECRET_KEY is not set' });
        }

        const resolvedCallbackUrl =
            callback_url ||
            process.env.PAYSTACK_CALLBACK_URL ||
            `${req.protocol}://${req.get('host')}/paystack/callback`;

        const resolvedReference = reference || `AC-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

        const payload = {
            email,
            amount,
            reference: resolvedReference,
            callback_url: resolvedCallbackUrl
        };

        if (currency) {
            payload.currency = currency;
        }

        if (metadata) {
            payload.metadata = metadata;
        }

        try {
            const response = await axios.post(PAYSTACK_INITIALIZE_URL, payload, {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            return res.json(response.data);
        } catch (error) {
            const status = error?.response?.status;
            const data = error?.response?.data;

            if (status === 400 && data && typeof data.message === 'string' && data.message.toLowerCase().includes('currency')) {
                const retryPayload = { ...payload };
                delete retryPayload.currency;

                const retryResponse = await axios.post(PAYSTACK_INITIALIZE_URL, retryPayload, {
                    headers: {
                        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });

                return res.json(retryResponse.data);
            }

            if (status && data) {
                return res.status(status).json({ status: false, message: 'Error initializing transaction', error: data });
            }

            return res.status(500).json({ status: false, message: 'Error initializing transaction', error: error.message });
        }
    } catch (error) {
        return res.status(500).json({ status: false, message: 'Error initializing transaction', error: error.message });
    }
});

app.get('/paystack/callback', (req, res) => {
    const reference = req.query?.reference || '';
    const safeReference = String(reference).replace(/[^a-zA-Z0-9._-]/g, '');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Paystack Callback</title>
  </head>
  <body>
    <script>
      (function () {
        var ref = ${JSON.stringify(safeReference)};
        try {
          if (window.opener && typeof window.opener.postMessage === 'function') {
            window.opener.postMessage({ type: 'paystack:callback', reference: ref }, window.location.origin);
            window.close();
            return;
          }
        } catch (e) {}

        var url = new URL(window.location.href);
        url.pathname = '/';
        url.search = ref ? ('?paystack_reference=' + encodeURIComponent(ref)) : '';
        window.location.replace(url.toString());
      })();
    </script>
  </body>
</html>`);
});

// Verify payment endpoint
app.post('/api/verify-payment', async (req, res) => {
    try {
        const { reference } = req.body;
        
        if (!reference) {
            return res.json({
                status: false,
                message: 'Reference is required'
            });
        }

        if (!PAYSTACK_SECRET_KEY) {
            return res.status(500).json({
                status: false,
                message: 'PAYSTACK_SECRET_KEY is not set'
            });
        }

        const response = await axios.get(`${PAYSTACK_VERIFY_URL}${reference}`, {
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const { status, data } = response.data;
        
        if (status === true && data && data.status === 'success') {
            return res.json({
                status: true,
                message: 'Payment verified successfully',
                data: data
            });
        }

        return res.json({
            status: true,
            message: 'Payment not confirmed yet',
            data: data
        });
    } catch (error) {
        const status = error?.response?.status;
        const data = error?.response?.data;

        console.error('Payment verification error:', error?.response?.data || error);

        if (status && data) {
            return res.status(status).json({
                status: false,
                message: 'Error verifying payment',
                error: data
            });
        }

        return res.status(500).json({
            status: false,
            message: 'Error verifying payment',
            error: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
