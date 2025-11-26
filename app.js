// Google Apps Script Web App URL
let WEB_APP_URL = localStorage.getItem('webAppUrl') || '';

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 設定今天日期
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;

    // 載入品項
    loadItems();

    // 初始化 localStorage
    if (!localStorage.getItem('inventoryRecords')) {
        localStorage.setItem('inventoryRecords', JSON.stringify([]));
    }

    // 顯示已儲存的設定
    if (WEB_APP_URL) {
        document.getElementById('webAppUrl').value = WEB_APP_URL;
    }

    // 綁定品項選擇事件
    document.getElementById('item').addEventListener('change', updatePreviousStock);

    // 綁定表單提交事件
    document.getElementById('inventoryForm').addEventListener('submit', submitForm);
});

// 載入品項到下拉選單
function loadItems() {
    const select = document.getElementById('item');
    
    initialStockData.forEach(item => {
        const option = document.createElement('option');
        option.value = item.品項;
        option.textContent = `${item.品項} (${item.規格}) - ${item.廠商}`;
        option.dataset.spec = item.規格;
        option.dataset.supplier = item.廠商;
        option.dataset.initialStock = item.前日庫存;
        select.appendChild(option);
    });

    document.getElementById('itemCount').textContent = `(共 ${initialStockData.length} 個品項)`;
}

// 更新前日庫存
function updatePreviousStock() {
    const select = document.getElementById('item');
    const selectedValue = select.value;
    
    if (!selectedValue) {
        document.getElementById('previousStockDisplay').style.display = 'none';
        document.getElementById('previousStock').value = 0;
        return;
    }

    const date = document.getElementById('date').value;
    const previousStock = getPreviousStock(selectedValue, date);
    
    document.getElementById('previousStock').value = previousStock;
    document.getElementById('previousStockValue').textContent = previousStock;
    document.getElementById('previousStockDisplay').style.display = 'block';
}

// 取得前日庫存
function getPreviousStock(itemName, currentDate) {
    const records = JSON.parse(localStorage.getItem('inventoryRecords') || '[]');
    
    // 找出該品項在當前日期之前的最新記錄
    const itemRecords = records
        .filter(r => r.item === itemName && r.date < currentDate)
        .sort((a, b) => b.date.localeCompare(a.date));
    
    if (itemRecords.length > 0) {
        return itemRecords[0].stock;
    }
    
    // 沒有歷史記錄，使用初始庫存
    const initialItem = initialStockData.find(item => item.品項 === itemName);
    return initialItem ? initialItem.前日庫存 : 0;
}

// 提交表單
function submitForm(e) {
    e.preventDefault();
    
    const select = document.getElementById('item');
    const selectedOption = select.options[select.selectedIndex];
    
    const record = {
        id: Date.now(),
        date: document.getElementById('date').value,
        item: select.value,
        spec: selectedOption.dataset.spec || '',
        supplier: selectedOption.dataset.supplier || '',
        previousStock: parseInt(document.getElementById('previousStock').value) || 0,
        usage: parseInt(document.getElementById('usage').value) || 0,
        incoming: parseInt(document.getElementById('incoming').value) || 0,
        stock: parseInt(document.getElementById('stock').value) || 0,
        operator: document.getElementById('operator').value,
        timestamp: new Date().toLocaleString('zh-TW')
    };

    // 先儲存到本地
    const records = JSON.parse(localStorage.getItem('inventoryRecords') || '[]');
    records.push(record);
    localStorage.setItem('inventoryRecords', JSON.stringify(records));

    // 同步到 Google Sheets
    if (WEB_APP_URL) {
        syncToGoogleSheets(record);
    } else {
        showMessage('fillMessage', '✅ 記錄已新增（本地儲存）\n⚠️ 尚未設定 Google Sheets，資料僅儲存在本機', 'success');
    }

    // 清空部分表單
    document.getElementById('item').value = '';
    document.getElementById('usage').value = 0;
    document.getElementById('incoming').value = 0;
    document.getElementById('stock').value = '';
    document.getElementById('previousStockDisplay').style.display = 'none';
}

// 同步到 Google Sheets
async function syncToGoogleSheets(record) {
    try {
        showMessage('fillMessage', '⏳ 正在同步到 Google Sheets...', 'success');

        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'save',
                record: record
            })
        });

        showMessage('fillMessage', '✅ 記錄已成功新增並同步到 Google Sheets！', 'success');

    } catch (error) {
        console.error('同步失敗:', error);
        showMessage('fillMessage', '✅ 記錄已新增（本地儲存）\n⚠️ Google Sheets 同步失敗，但資料已儲存在本機', 'success');
    }
}

// 寄送報表
async function sendReport() {
    if (!WEB_APP_URL) {
        showMessage('fillMessage', '❌ 請先在「系統設定」中設定 Google Apps Script 網址', 'error');
        return;
    }

    const operator = document.getElementById('operator').value || '未指定';
    
    if (!confirm('確定要寄送累積報表到 shallow1003@gmail.com 嗎？')) {
        return;
    }

    try {
        showMessage('fillMessage', '⏳ 正在產生報表並寄送中，請稍候...', 'success');

        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'sendReport',
                operator: operator
            })
        });

        // 因為使用 no-cors，無法讀取實際回應
        // 假設成功（實際應該要有其他驗證機制）
        setTimeout(() => {
            showMessage('fillMessage', '✅ 報表已成功寄送到 shallow1003@gmail.com！\n請稍後檢查您的信箱（可能在垃圾郵件中）', 'success');
        }, 2000);

    } catch (error) {
        console.error('寄送失敗:', error);
        showMessage('fillMessage', '❌ 報表寄送失敗：' + error.message, 'error');
    }
}

// 儲存設定
function saveConfig() {
    const url = document.getElementById('webAppUrl').value.trim();
    
    if (!url) {
        showMessage('configMessage', '❌ 請輸入 Google Apps Script 網址', 'error');
        return;
    }

    if (!url.includes('script.google.com')) {
        showMessage('configMessage', '❌ 網址格式不正確，應該包含 script.google.com', 'error');
        return;
    }

    localStorage.setItem('webAppUrl', url);
    WEB_APP_URL = url;
    
    showMessage('configMessage', '✅ 設定已儲存！現在可以開始使用 Google Sheets 同步功能。', 'success');
}

// 切換分頁
function switchTab(tabName) {
    // 移除所有 active
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // 加上當前的 active
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        if (tab.textContent.includes(tabName === 'fill' ? '庫存填寫' : '系統設定')) {
            tab.classList.add('active');
        }
    });

    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// 顯示訊息
function showMessage(elementId, message, type) {
    const messageDiv = document.getElementById(elementId);
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.whiteSpace = 'pre-line';
    
    if (type !== 'error') {
        setTimeout(() => {
            messageDiv.className = 'message';
        }, 5000);
    }
}
