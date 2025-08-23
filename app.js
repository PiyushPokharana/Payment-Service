// Razorpay Integration Demo JavaScript

// Application state
const appState = {
    currentTab: 'products',
    transactions: [
        {
            id: "txn_001",
            order_id: "order_EKwxwAgItmmXdp",
            payment_id: "pay_EKwxwBgDtmmXdq",
            amount: 500000,
            currency: "INR",
            status: "success",
            created_at: "2025-08-23T10:30:00Z",
            payment_method: "card"
        },
        {
            id: "txn_002", 
            order_id: "order_FLwxwAgItmmXer",
            payment_id: "pay_FLwxwBgDtmmXes",
            amount: 750000,
            currency: "INR",
            status: "pending",
            created_at: "2025-08-23T09:15:00Z",
            payment_method: "upi"
        },
        {
            id: "txn_003",
            order_id: "order_GMwxwAgItmmXft",
            payment_id: "pay_GMwxwBgDtmmXgu",
            amount: 300000,
            currency: "INR", 
            status: "failed",
            created_at: "2025-08-23T08:45:00Z",
            payment_method: "netbanking"
        }
    ],
    demoLog: []
};

// Demo API endpoints simulation
const demoAPI = {
    createOrder: async (amount, currency, receipt) => {
        // Simulate API delay
        await delay(1000);
        
        const orderId = generateOrderId();
        const response = {
            success: true,
            order_id: orderId,
            amount: amount,
            currency: currency,
            receipt: receipt
        };
        
        logToDemo(`✅ Order created: ${orderId}`);
        logToDemo(`💰 Amount: ₹${(amount/100).toFixed(2)}`);
        
        return response;
    },
    
    verifyPayment: async (paymentId, orderId, signature) => {
        // Simulate signature verification
        await delay(800);
        
        const isValid = Math.random() > 0.1; // 90% success rate for demo
        
        if (isValid) {
            logToDemo(`✅ Payment signature verified successfully`);
            logToDemo(`🔐 Signature: ${signature.substring(0, 20)}...`);
            return {
                success: true,
                message: "Payment verified successfully",
                status: "captured"
            };
        } else {
            logToDemo(`❌ Invalid payment signature`);
            return {
                success: false,
                message: "Invalid signature"
            };
        }
    },
    
    saveTransaction: async (transactionData) => {
        await delay(500);
        
        const newTransaction = {
            id: `txn_${Date.now()}`,
            ...transactionData,
            created_at: new Date().toISOString()
        };
        
        appState.transactions.unshift(newTransaction);
        updateTransactionTable();
        
        logToDemo(`💾 Transaction saved to database: ${newTransaction.id}`);
        
        return newTransaction;
    }
};

// Utility functions
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function generateOrderId() {
    return `order_${Math.random().toString(36).substring(2, 15)}`;
}

function generatePaymentId() {
    return `pay_${Math.random().toString(36).substring(2, 15)}`;
}

function generateSignature() {
    return Math.random().toString(36).substring(2, 30) + Math.random().toString(36).substring(2, 30);
}

function formatCurrency(amount, currency = 'INR') {
    return `₹${(amount / 100).toFixed(2)}`;
}

function formatDateTime(dateString) {
    return new Date(dateString).toLocaleString('en-IN');
}

function logToDemo(message) {
    const timestamp = new Date().toLocaleTimeString();
    appState.demoLog.push(`[${timestamp}] ${message}`);
    updateDemoLog();
}

function updateDemoLog() {
    const logElement = document.getElementById('demo-log');
    if (logElement) {
        logElement.innerHTML = appState.demoLog
            .slice(-15) // Show last 15 entries
            .map(entry => `<div class="log-entry">${entry}</div>`)
            .join('');
        
        // Auto scroll to bottom
        logElement.scrollTop = logElement.scrollHeight;
    }
}

function clearDemoLog() {
    appState.demoLog = [];
    const logElement = document.getElementById('demo-log');
    if (logElement) {
        logElement.innerHTML = '<div class="log-entry">Demo log cleared. Ready to start...</div>';
    }
}

// Tab navigation - Fixed implementation
function initializeTabs() {
    console.log('🔧 Initializing tab navigation...');
    
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    console.log(`Found ${tabButtons.length} tab buttons and ${tabContents.length} tab contents`);

    tabButtons.forEach((button, index) => {
        console.log(`Setting up tab button ${index}: ${button.dataset.tab}`);
        
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = button.dataset.tab;
            console.log(`Tab clicked: ${tabId}`);
            switchTab(tabId);
        });
    });

    // Initialize first tab
    switchTab('products');
    console.log('✅ Tab navigation initialized');
}

function switchTab(tabId) {
    console.log(`🔄 Switching to tab: ${tabId}`);
    
    // Update button states
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeButton = document.querySelector(`[data-tab="${tabId}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
        console.log(`✅ Activated button for ${tabId}`);
    }

    // Update content visibility
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.classList.remove('active');
    });
    
    const activeContent = document.getElementById(tabId);
    if (activeContent) {
        activeContent.classList.add('active');
        console.log(`✅ Activated content for ${tabId}`);
    }

    appState.currentTab = tabId;
    
    // Update transaction table if switching to transactions tab
    if (tabId === 'transactions') {
        updateTransactionTable();
    }
}

// Payment processing - Fixed implementation
function initializePaymentButtons() {
    console.log('🔧 Initializing payment buttons...');
    
    const paymentButtons = document.querySelectorAll('.pay-now-btn');
    console.log(`Found ${paymentButtons.length} payment buttons`);
    
    paymentButtons.forEach((button, index) => {
        console.log(`Setting up payment button ${index}`);
        
        button.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const amount = parseInt(e.target.dataset.amount);
            const productName = e.target.dataset.name;
            
            console.log(`Payment initiated: ${productName}, Amount: ${amount}`);
            
            await processPayment(amount, productName, button);
        });
    });
    
    console.log('✅ Payment buttons initialized');
}

async function processPayment(amount, productName, buttonElement) {
    console.log(`🔄 Processing payment for ${productName}`);
    
    try {
        // Disable button and show loading state
        buttonElement.disabled = true;
        buttonElement.classList.add('loading');
        buttonElement.textContent = 'Processing...';
        
        // Step 1: Create order
        logToDemo(`🚀 Starting payment process for: ${productName}`);
        logToDemo(`📝 Creating order...`);
        
        const orderResponse = await demoAPI.createOrder(
            amount, 
            'INR', 
            `receipt_${Date.now()}`
        );

        if (!orderResponse.success) {
            throw new Error('Failed to create order');
        }

        // Step 2: Simulate Razorpay checkout (in real implementation, this would open Razorpay modal)
        logToDemo(`💳 Opening Razorpay checkout...`);
        await delay(1500);

        // Simulate payment success (90% success rate)
        const paymentSuccess = Math.random() > 0.1;
        
        if (!paymentSuccess) {
            throw new Error('Payment failed or cancelled by user');
        }

        const paymentId = generatePaymentId();
        const signature = generateSignature();
        
        logToDemo(`✅ Payment completed by user`);
        logToDemo(`🔖 Payment ID: ${paymentId}`);

        // Step 3: Verify payment
        logToDemo(`🔍 Verifying payment signature...`);
        
        const verificationResponse = await demoAPI.verifyPayment(
            paymentId,
            orderResponse.order_id,
            signature
        );

        if (!verificationResponse.success) {
            throw new Error('Payment verification failed');
        }

        // Step 4: Save transaction
        logToDemo(`💾 Saving transaction to database...`);
        
        const transactionData = {
            order_id: orderResponse.order_id,
            payment_id: paymentId,
            amount: amount,
            currency: 'INR',
            status: 'success',
            payment_method: 'card'
        };

        await demoAPI.saveTransaction(transactionData);

        // Step 5: Show success
        logToDemo(`🎉 Payment completed successfully!`);
        
        // Show success modal
        showPaymentSuccessModal({
            productName,
            amount,
            paymentId,
            orderId: orderResponse.order_id
        });

        console.log('✅ Payment processed successfully');

    } catch (error) {
        console.error('❌ Payment error:', error);
        logToDemo(`❌ Payment failed: ${error.message}`);
        
        // Save failed transaction
        if (typeof orderResponse !== 'undefined' && orderResponse) {
            await demoAPI.saveTransaction({
                order_id: orderResponse.order_id || 'N/A',
                payment_id: 'N/A',
                amount: amount,
                currency: 'INR',
                status: 'failed',
                payment_method: 'card'
            });
        }
        
        alert(`Payment failed: ${error.message}`);
        
    } finally {
        // Re-enable button
        buttonElement.disabled = false;
        buttonElement.classList.remove('loading');
        buttonElement.textContent = 'Pay Now';
    }
}

// Demo payment flow
function initializeDemoPayment() {
    console.log('🔧 Initializing demo payment...');
    
    const demoButton = document.getElementById('demo-payment-btn');
    
    if (demoButton) {
        demoButton.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('🚀 Starting demo payment flow');
            
            clearDemoLog();
            demoButton.disabled = true;
            demoButton.textContent = 'Running Demo...';
            
            try {
                await runDemoPaymentFlow();
            } finally {
                demoButton.disabled = false;
                demoButton.textContent = 'Start Demo Payment Flow';
            }
        });
        
        console.log('✅ Demo payment button initialized');
    } else {
        console.log('⚠️  Demo payment button not found');
    }
}

async function runDemoPaymentFlow() {
    logToDemo('🎬 Starting comprehensive payment flow demo...');
    await delay(1000);

    // Step 1: Frontend initiates payment
    logToDemo('🖥️  Frontend: User clicks "Pay Now" button');
    logToDemo('📤 Frontend: Making API call to /create-order');
    await delay(800);

    // Step 2: Backend creates order
    logToDemo('🖧  Backend: Received order creation request');
    logToDemo('🔑 Backend: Authenticating with Razorpay API');
    await delay(600);

    const orderId = generateOrderId();
    logToDemo(`✅ Backend: Order created successfully - ${orderId}`);
    logToDemo('📤 Backend: Sending order_id back to frontend');
    await delay(500);

    // Step 3: Frontend opens Razorpay
    logToDemo('🖥️  Frontend: Received order_id, initializing Razorpay');
    logToDemo('💳 Frontend: Opening Razorpay checkout modal');
    await delay(1000);

    // Step 4: User payment
    logToDemo('👤 User: Entering payment details');
    await delay(1500);
    logToDemo('🔐 Razorpay: Processing payment securely');
    await delay(1200);

    const paymentId = generatePaymentId();
    const signature = generateSignature();
    logToDemo(`✅ Razorpay: Payment successful - ${paymentId}`);
    logToDemo('📤 Razorpay: Sending payment details to frontend');
    await delay(500);

    // Step 5: Frontend verification
    logToDemo('🖥️  Frontend: Payment successful, sending to backend for verification');
    logToDemo('📤 Frontend: POST /verify-payment with signature');
    await delay(600);

    // Step 6: Backend verification
    logToDemo('🖧  Backend: Received payment verification request');
    logToDemo('🔍 Backend: Generating signature for comparison');
    logToDemo('🔐 Backend: HMAC SHA256 signature verification');
    await delay(800);
    
    logToDemo('✅ Backend: Signature verified - payment authentic');
    logToDemo('💾 Backend: Saving transaction to database');
    await delay(700);

    // Step 7: Database operations
    logToDemo('🗄️  Database: INSERT INTO transactions...');
    logToDemo('📊 Database: Transaction record created');
    await delay(500);

    // Step 8: Success response
    logToDemo('📤 Backend: Sending success response to frontend');
    logToDemo('🖥️  Frontend: Displaying success message to user');
    logToDemo('🎉 Complete: Payment flow finished successfully!');
    
    await delay(1000);
    logToDemo('');
    logToDemo('💡 Key Security Points Demonstrated:');
    logToDemo('   • Server-side order creation');
    logToDemo('   • Signature verification prevents tampering');
    logToDemo('   • Database transaction only after verification');
    logToDemo('   • No sensitive data stored on frontend');
}

// Modal functions - Fixed implementation
function showPaymentSuccessModal(paymentData) {
    console.log('🔄 Showing payment success modal');
    
    const modal = document.getElementById('payment-success-modal');
    const detailsElement = document.getElementById('payment-details');
    
    if (!modal || !detailsElement) {
        console.error('❌ Modal elements not found');
        return;
    }
    
    detailsElement.innerHTML = `
        <p><strong>Product:</strong> ${paymentData.productName}</p>
        <p><strong>Amount:</strong> ${formatCurrency(paymentData.amount)}</p>
        <p><strong>Payment ID:</strong> ${paymentData.paymentId}</p>
        <p><strong>Order ID:</strong> ${paymentData.orderId}</p>
        <p><strong>Status:</strong> <span class="status status--success">Success</span></p>
        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
    `;
    
    modal.classList.remove('hidden');
    console.log('✅ Payment success modal displayed');
}

function closeModal() {
    console.log('🔄 Closing modal');
    
    const modal = document.getElementById('payment-success-modal');
    if (modal) {
        modal.classList.add('hidden');
        console.log('✅ Modal closed');
    }
}

// Transaction table management - Fixed implementation
function updateTransactionTable() {
    console.log('🔄 Updating transaction table');
    
    const tbody = document.getElementById('transactions-tbody');
    if (!tbody) {
        console.log('⚠️  Transaction table body not found');
        return;
    }

    tbody.innerHTML = appState.transactions.map(transaction => {
        const statusClass = transaction.status === 'success' ? 'status--success' : 
                          transaction.status === 'pending' ? 'status--warning' : 'status--error';
        
        return `
            <tr>
                <td>${transaction.id}</td>
                <td>${transaction.order_id}</td>
                <td>${transaction.payment_id || 'N/A'}</td>
                <td>${formatCurrency(transaction.amount)}</td>
                <td><span class="status ${statusClass}">${transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}</span></td>
                <td>${transaction.payment_method.charAt(0).toUpperCase() + transaction.payment_method.slice(1)}</td>
                <td>${formatDateTime(transaction.created_at)}</td>
            </tr>
        `;
    }).join('');
    
    console.log(`✅ Transaction table updated with ${appState.transactions.length} transactions`);
}

// Initialize application - Fixed implementation
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Razorpay Integration Demo - Starting initialization...');
    
    try {
        // Initialize all components with error handling
        console.log('🔧 Initializing tabs...');
        initializeTabs();
        
        console.log('🔧 Initializing payment buttons...');
        initializePaymentButtons();
        
        console.log('🔧 Initializing demo payment...');
        initializeDemoPayment();
        
        console.log('🔧 Updating transaction table...');
        updateTransactionTable();
        
        // Add click handler for modal close
        document.addEventListener('click', function(e) {
            const modal = document.getElementById('payment-success-modal');
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // Add keyboard support for modal
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeModal();
            }
        });
        
        // Add welcome message to demo log
        setTimeout(() => {
            logToDemo('🎯 Razorpay Integration Demo Ready');
            logToDemo('💡 Click "Start Demo Payment Flow" to see the complete process');
            logToDemo('🛒 Or click "Pay Now" on any product to simulate payment');
        }, 500);
        
        console.log('✅ Application initialized successfully');
        
    } catch (error) {
        console.error('❌ Error during initialization:', error);
    }
});

// Export for debugging
if (typeof window !== 'undefined') {
    window.appState = appState;
    window.demoAPI = demoAPI;
    window.switchTab = switchTab; // Export for manual testing
    window.showPaymentSuccessModal = showPaymentSuccessModal; // Export for manual testing
}