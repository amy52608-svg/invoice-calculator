// DOM Elements
const amountInput = document.getElementById('amountInput');
const amountInputLabel = document.getElementById('amountInputLabel');
const radioTaxTypes = document.getElementsByName('taxType');
const radioTaxRates = document.getElementsByName('taxRate');

const salesAmountEl = document.getElementById('salesAmount');
const taxAmountEl = document.getElementById('taxAmount');
const totalAmountEl = document.getElementById('totalAmount');
const uppercaseAmountEl = document.getElementById('uppercaseAmount');

const taxIdInput = document.getElementById('taxIdInput');
const verifyBtn = document.getElementById('verifyBtn');
const taxIdMessage = document.getElementById('taxIdMessage');
const companyNameDisplay = document.getElementById('companyNameDisplay');
const printBtn = document.getElementById('printBtn');

const printTaxId = document.getElementById('printTaxId');
const printCompanyName = document.getElementById('printCompanyName');
const printCompanyInfo = document.getElementById('printCompanyInfo');

// --- Calculation Logic ---

function formatCurrency(num) {
    return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
}

function convertToUppercase(num) {
    if (isNaN(num) || num === 0) return '零元整';

    const digits = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖'];
    const units = ['', '拾', '佰', '仟', '萬', '拾', '佰', '仟', '億', '拾', '佰', '仟', '兆'];

    num = Math.round(num);
    let strNum = Math.abs(num).toString();
    let result = '';

    for (let i = 0; i < strNum.length; i++) {
        let n = parseInt(strNum.charAt(i));
        let u = strNum.length - 1 - i; // unit position

        if (n !== 0) {
            result += digits[n] + units[u];
        } else {
            // Check if we need to add '零'
            if (result.length > 0 && result.charAt(result.length - 1) !== '零' && u !== 0 && u !== 4 && u !== 8) { // Don't add if previous is '零', or position is unit/萬/億
                result += '零';
            }
            // Add '萬' or '億' if necessary even if digit is zero
            if ((u === 4 || u === 8) && result.length > 0 && result.charAt(result.length - 1) !== '億' && result.charAt(result.length - 1) !== '萬') {
                // Remove trailing '零' before adding 萬/億
                if (result.charAt(result.length - 1) === '零') {
                    result = result.substring(0, result.length - 1);
                }
                result += units[u];
            }
        }
    }

    // Cleanup any trailing '零'
    if (result.charAt(result.length - 1) === '零') {
        result = result.substring(0, result.length - 1);
    }

    return num < 0 ? '負' + result + '元整' : result + '元整';
}

function calculateInvoice() {
    const inputVal = parseFloat(amountInput.value) || 0;

    let taxType = 'exclusive';
    for (const radio of radioTaxTypes) {
        if (radio.checked) taxType = radio.value;
    }

    let taxRateVal = 0.05;
    for (const radio of radioTaxRates) {
        if (radio.checked) {
            taxRateVal = radio.value === 'free' ? 0 : parseFloat(radio.value);
        }
    }

    let sales = 0;
    let tax = 0;
    let total = 0;

    if (taxRateVal === 0) { // 零稅率 or 免稅
        sales = inputVal;
        tax = 0;
        total = inputVal;
    } else {
        if (taxType === 'exclusive') {
            // Input is sales amount (未稅)
            sales = inputVal;
            tax = Math.round(sales * taxRateVal);
            total = sales + tax;
        } else {
            // Input is total amount (含稅)
            total = inputVal;
            sales = Math.round(total / (1 + taxRateVal));
            tax = total - sales;
        }
    }

    // Update UI
    salesAmountEl.textContent = formatCurrency(sales);
    taxAmountEl.textContent = formatCurrency(tax);
    totalAmountEl.textContent = formatCurrency(total);
    uppercaseAmountEl.textContent = convertToUppercase(total);
}

// --- Tax ID Logic ---

function checkTaxId(taxId) {
    if (!/^\d{8}$/.test(taxId)) {
        return false;
    }

    const multipliers = [1, 2, 1, 2, 1, 2, 4, 1];
    let sum = 0;
    let hasSevenInSeventh = (taxId.charAt(6) === '7');

    for (let i = 0; i < 8; i++) {
        let product = parseInt(taxId.charAt(i)) * multipliers[i];
        sum += Math.floor(product / 10) + (product % 10);
    }

    if (sum % 10 === 0) {
        return true;
    }

    if (hasSevenInSeventh && (sum + 1) % 10 === 0) {
        return true; // Special case for 7 in 7th position
    }

    return false;
}

async function fetchCompanyInfo(taxId) {
    taxIdMessage.textContent = '查詢中...';
    taxIdMessage.className = 'message';
    companyNameDisplay.classList.remove('active');
    companyNameDisplay.innerHTML = '';

    printCompanyInfo.style.display = 'none';
    printTaxId.textContent = '-';
    printCompanyName.textContent = '-';

    if (!checkTaxId(taxId)) {
        taxIdMessage.textContent = '統一編號格式錯誤或為無效號碼';
        taxIdMessage.className = 'message error';
        return;
    }

    taxIdMessage.textContent = '統一編號邏輯正確';
    taxIdMessage.className = 'message success';

    try {
        const response = await fetch(`https://company.g0v.ronny.tw/api/show/${taxId}`);
        const data = await response.json();

        let displayHtml = '';
        let companyNameStr = '';

        if (data && data.data && data.data['公司名稱']) {
            companyNameStr = data.data['公司名稱'];
            displayHtml = `<strong>公司名稱：</strong> ${companyNameStr}<br>
                           <small style="color:var(--text-muted)">資料來源：臺灣公司資料網站</small>`;
        } else if (data && data.data && data.data['商業名稱']) {
            companyNameStr = data.data['商業名稱'];
            displayHtml = `<strong>商號名稱：</strong> ${companyNameStr}<br>
                           <small style="color:var(--text-muted)">資料來源：臺灣公司資料網站</small>`;
        } else {
            // Fallback message for valid tax IDs not in the company database (e.g., NGOs, Gov)
            companyNameStr = '無對應公司資訊 (非屬公司/商業登記)';
            displayHtml = `<strong>未能取得名稱</strong><br>
                           <small style="color:var(--warning)">若顯示無對應公司資訊，可能該統編為行號、有限合夥、分支機構、事務所、社團法人、財團法人、政府機關等。</small>`;
        }

        companyNameDisplay.innerHTML = displayHtml;
        companyNameDisplay.classList.add('active');

        // Prepare print variables
        printCompanyInfo.style.display = 'block';
        printTaxId.textContent = taxId;
        printCompanyName.textContent = companyNameStr;

    } catch (e) {
        console.error('API Error:', e);
        taxIdMessage.textContent += ' (無法連線至公司資料庫)';
    }
}

// --- Event Listeners ---

amountInput.addEventListener('input', calculateInvoice);

radioTaxTypes.forEach(radio => {
    radio.addEventListener('change', () => {
        let taxType = 'exclusive';
        for (const r of radioTaxTypes) {
            if (r.checked) taxType = r.value;
        }
        // Update Label to make it obviously clear
        if (taxType === 'exclusive') {
            amountInputLabel.innerHTML = '請輸入 <strong>未稅金額</strong> (NT$)';
        } else {
            amountInputLabel.innerHTML = '請輸入 <strong>含稅總額</strong> (NT$)';
        }
        calculateInvoice();
    });
});

radioTaxRates.forEach(radio => {
    radio.addEventListener('change', calculateInvoice);
});

verifyBtn.addEventListener('click', () => {
    const taxId = taxIdInput.value.trim();
    if (taxId.length === 8) {
        fetchCompanyInfo(taxId);
    } else {
        taxIdMessage.textContent = '請輸入 8 碼數字';
        taxIdMessage.className = 'message error';
    }
});

taxIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        verifyBtn.click();
    }
});

printBtn.addEventListener('click', () => {
    window.print();
});

// Init
calculateInvoice();
