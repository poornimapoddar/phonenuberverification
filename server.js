const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const twilio = require('twilio');
const cors = require('cors'); // Import the CORS package
const rateLimit = require('express-rate-limit'); // Import the rate limiter package
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors()); 

// Rate limiter middleware
const limiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 15 minutes
    max: 6000, // limit each IP to 3 requests per windowMs
    message: { success: false, error: 'Too many OTP requests from this IP, please try again after 15 minutes' }
});

app.post('/phone-verification/send-otp', limiter, (req, res) => {
    const { phone, clientName } = req.body;
    let accountSid;
    let authToken;
    let verifyServiceSid;

    switch (clientName) {
          case "":
            accountSid = process.env._ACCOUNT_SID;
            authToken = process.env._AUTH_TOKEN;
            verifyServiceSid = process.env._VERIFY_SERVICE_ID;
            break;
        default:
            accountSid = "";
    }

    if (accountSid === "" || authToken === "") {
        res.json({ success: false, error: "client name not found", phoneNumber: phone, clientname: clientName });
        return;
    }

    const client = twilio(accountSid, authToken);

    client.verify.v2.services(verifyServiceSid)
        .verifications
        .create({ to: phone, channel: 'sms' })
        .then(verification => res.json({ success: true }))
        .catch(error => {
            console.error('Error sending OTP:', error);
            res.json({ success: false, error });
        });
});

app.post('/phone-verification/verify-otp', (req, res) => {
    const { phone, otp, clientName } = req.body;
    let accountSid;
    let authToken;
    let verifyServiceSid;

    switch (clientName) {
        
          case "ISES":  
            accountSid = process.env.ISES_ACCOUNT_SID;
            authToken = process.env.ISES_AUTH_TOKEN;
            verifyServiceSid = process.env.ISES_VERIFY_SERVICE_ID;
            break; 
        default:
            accountSid = "";
    }

    if (accountSid === "" || authToken === "") {
        res.json({ success: false, error: "client name not found", phoneNumber: phone, clientname: clientName });
        return;
    }

    const client = twilio(accountSid, authToken);

    client.verify.v2.services(verifyServiceSid)
        .verificationChecks
        .create({ to: phone, code: otp })
        .then(verification_check => {
            if (verification_check.status === 'approved') {
                res.json({ success: true });
            } else {
                res.json({ success: false });
            }
        })
        .catch(error => {
            console.error('Error verifying OTP:', error);
            res.json({ success: false, error });
        });
});

app.get('/phone-verification/test', (req, res) => {
    res.json({ success: 'test call' });
});

app.get('/phone-verification', (req, res) => {
    res.json({ success: "server is running." });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
