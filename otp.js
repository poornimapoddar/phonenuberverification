const phoneInput = document.getElementById('phone');
const otpSection = document.getElementById('otp-section');
const signupForm = document.getElementById('signup-form');
const numberError = document.getElementById('number-error');
const otpError = document.getElementById('otp-error');
const apiUrl = 'https://otp1.webuildapi.com/phone-verification'; // Local server endpoint

function validatePhoneNumber(phone) {
    return /^\+[1-9]\d{1,14}$/.test(phone);
}

function validateOTP(otp) {
    return /^\d{4,6}$/.test(otp);
}

function showLoading(isLoading) {
    // Implement this function to show/hide a loading indicator
}

function showError(message, isOTP = false) {
    if (isOTP) {
        otpError.textContent = message;
    } else {
        numberError.textContent = message;
    }
}

function sendOTP() {
    const phoneNumber = phoneInput.value;

    if (!validatePhoneNumber(phoneNumber)) {
        showError('Please enter a valid phone number.');
        return;
    }

    showLoading(true);

    fetch(`${apiUrl}/send-otp`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            phone: phoneNumber,
            clientName: 'Nuera'
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        showLoading(false);
        if (data.success) {
            numbersection.style.display = 'none';
            otpSection.style.display = 'block';
            
             
            
        } else {
            if (data.error === 'Too many OTP requests from this IP, please try again after 15 minutes') {
                showError('Too many OTP requests. Please try again after 15 minutes.');
            } else {
                showError(data.error || 'Failed to send OTP. Please try again.');
            }
        }
    })
    .catch(error => {
        showLoading(false);
        console.error('Error:', error);
        showError('Too many OTP requests. Please try again later.');
    });
}

function verifyOTP() {
    const otp = [...document.querySelectorAll('.otp-input')].map(input => input.value).join('');
    const phoneNumber = phoneInput.value;

    if (!validateOTP(otp)) {
        showError('Please enter a valid OTP.', true);
        return;
    }

    showLoading(true);

    fetch(`${apiUrl}/verify-otp`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            phone: phoneNumber,
            otp: otp,
            clientName: 'Nuera'
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        showLoading(false);
        if (data.success) {
            sendVarifiedDataToZapier();
        } else {
            showError(data.error || 'Invalid OTP. Please try again.', true);
        }
    })
    .catch(error => {
        showLoading(false);
        console.error('Error:', error);
        showError('An error occurred. Please try again later.', true);
    });
}


function sendVarifiedDataToZapier() { 
    var varifiedPhoneNumber = $("#phone").val();
    var zapierURL = sessionStorage.getItem("zapierURL");

    var postdata = JSON.parse(sessionStorage.getItem("zapierPostData"));
    postdata.refId = sessionStorage.getItem("recordID");
    postdata.phone = varifiedPhoneNumber;
    postdata.PhonNo = varifiedPhoneNumber;
    postdata.varifiedPhoneNumber = varifiedPhoneNumber;
    postdata.tag = "verified quote";

    fetch(zapierURL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(postdata)
    })
    .then(() => {
        console.log('Session data sent to webhook successfully');
        window.location.href = sessionStorage.getItem("nextPageURL");
    })
    .catch(error => {
        console.error('Error sending session data to webhook:', error);
    });
}

function testCall() {
    fetch(`${apiUrl}/test`, {
        method: 'get',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        alert("done");
    })
    .catch(error => {
        alert("error");
        console.error('Error:', error);
    });
}
