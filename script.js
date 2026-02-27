// Sheet config
const sheetId = '1pXxOXe61Tm5eZ-gdYhySezVyIYjPdawvM_EuuMPiqZg';
const sheetName = 'Data'; // Đổi tên nếu sheet/tab khác

function normalizeSheetRow(row) {
    const keys = Object.keys(row);
    const keyName = keys.find(k => k.toLowerCase().includes('name')) || keys[0];
    const keyNumber = keys.find(k => k.toLowerCase().includes('number') || k.toLowerCase().includes('số') || k.toLowerCase().includes('id')) || keys[1] || keys[0];
    return { name: row[keyName], number: row[keyNumber] };
    
}
// Optional: deploy a Google Apps Script web app and paste its URL here
// Example Apps Script returns JSON array of rows: [{"name":"...","number":"..."}, ...]

const appsScriptUrl = '';
document.addEventListener("DOMContentLoaded", () => {
    const boxContainer = document.getElementById("box-container");
    const startButton = document.getElementById("start-button");
    const clearButton = document.getElementById("clear-button");
    const forceUpdateButton = document.getElementById("force-update-button");
    const employeesButton = document.getElementById("employees-button");
    const resultsTable = document.getElementById("results-table").querySelector("tbody");
    const employeesTable = document.getElementById("employees-table");
    const employeesTableBody = employeesTable ? employeesTable.querySelector("tbody") : null;
    const popup = document.getElementById("popup");
    const employeesModal = document.getElementById("employees-modal");
    const winningNumberElement = document.getElementById("winning-number");
    const closePopupButton = document.getElementById("close-popup");
    const closeEmployeesButton = document.getElementById("close-employees");
    const spinSound = document.getElementById("spin-sound"); // Đối tượng âm thanh quay số
    const winSound = document.getElementById("win-sound"); // Đối tượng âm thanh trúng thưởng

    const delay = 50; // Độ trễ khi quay (ms)
    let customers = []; // Mảng chứa khách hàng sẽ quay
    let allCustomers = []; // Giữ bản đầy đủ để hiển thị
    let selectedCustomer = {}; // Khách hàng được chọn
    let resultCounter = 1; // Đếm số kết quả đã trúng

    // Tạo các ô số (tạo lại, số lượng có thể truyền vào)
    function createBoxes(count = 10) {
        if (!boxContainer) return;
        boxContainer.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const box = document.createElement("div");
            box.classList.add("box");
            box.textContent = "?";
            boxContainer.appendChild(box);
        }
    }

    // Đọc dữ liệu khách hàng: thử Google Sheet (opensheet), fallback về file JSON
    async function fetchCustomers() {
        // 1) Try Apps Script endpoint if configured
        if (appsScriptUrl) {
            try {
                const resAS = await fetch(appsScriptUrl);
                if (resAS.ok) {
                    const sheetData = await resAS.json();
                    const mapped = sheetData.map(normalizeSheetRow).filter(r => r.number && r.name);
                    if (mapped.length > 0) {
                        allCustomers = mapped;
                        customers = [...allCustomers];
                        renderEmployeesTable(customers);
                        console.log('Loaded customers from Apps Script endpoint');
                        console.log('Customers data:', allCustomers);
                        return;
                    }
                } else {
                    console.warn('Apps Script response not OK', resAS.status);
                }
            } catch (e) {
                console.warn('Apps Script fetch failed:', e);
            }
        }

        // 2) Try opensheet
        try {
            const opensheetUrl = `https://opensheet.elk.sh/${sheetId}/${sheetName}`;
            const res = await fetch(opensheetUrl);
            if (res.ok) {
                const sheetData = await res.json();
                const mapped = sheetData.map(normalizeSheetRow).filter(r => r.number && r.name);
                if (mapped.length > 0) {
                    allCustomers = mapped;
                    customers = [...allCustomers];
                    renderEmployeesTable(customers);
                    console.log('Loaded customers from Google Sheet (opensheet)');
                    console.log('Customers data:', allCustomers);
                    return;
                }
            } else {
                console.warn('Opensheet response not OK', res.status);
            }
        } catch (e) {
            console.warn('Opensheet fetch failed:', e);
        }

        // 3) Fallback to local data.json
        try {
            const response = await fetch("data.json");
            const data = await response.json();
            allCustomers = [...data.customers];
            customers = [...allCustomers];
            renderEmployeesTable(customers);
            console.log('Loaded customers from local data.json');
            console.log('Customers data:', allCustomers);
        } catch (err) {
            console.error('Failed to load customers from apps script, opensheet and data.json', err);
            allCustomers = [];
            customers = [];
        }
    }

    // Đọc kết quả trúng từ file JSON
    async function loadResults() {
        const response = await fetch("results.json");
        const data = await response.json();
        const results = data.results;

        results.forEach((customer, index) => {
            addResultToTable(customer, index + 1);
        });

        resultCounter = results.length + 1; // Cập nhật số thứ tự tiếp theo

        // Loại bỏ những khách hàng đã trúng khỏi mảng customers để danh sách "còn lại" đúng
        if (results && results.length && customers && customers.length) {
            const wonNumbers = new Set(results.map(r => String(r.number)));
            customers = customers.filter(c => !wonNumbers.has(String(c.number)));
        }
    }

    // Lưu kết quả trúng vào file JSON
    async function saveResult(customer) {
        const response = await fetch("results.json");
        const data = await response.json();
        const results = data.results;

        results.push(customer);

        await fetch("results.json", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ results }),
        });
    }

    // Xóa toàn bộ kết quả trong file JSON
    async function clearResults() {
        await fetch("results.json", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ results: [] }),
        });
    }

    // Reset tất cả các ô về dấu ?
    function resetBoxes() {
        const boxes = document.querySelectorAll(".box");
        boxes.forEach((box) => {
            box.textContent = "?";
            box.classList.remove("active");
        });
    }

    // Quay số cho một ô
    function spinBox(box, digit, delayTime) {
        return new Promise((resolve) => {
            const interval = setInterval(() => {
                box.textContent = Math.floor(Math.random() * 10); // Hiển thị số ngẫu nhiên từ 0-9
            }, delayTime); // Use the custom delayTime

            // Dừng quay sau 1 giây và hiển thị số thực tế
            setTimeout(() => {
                clearInterval(interval);
                box.textContent = digit; // Gán chữ số thực
                resolve();
            }, 1000);
        });
    }

    // Quay từng ô cho số được chọn (ngẫu nhiên)
    async function spinBoxesSequentially() {
        if (customers.length === 0) {
            alert("Không còn khách hàng nào để quay!");
            return;
        }

        // Disable nút quay khi đang quay
        startButton.disabled = true;

        // Reset tất cả các ô về dấu ?
        resetBoxes();

        // Lấy ngẫu nhiên một khách hàng từ danh sách và xóa nó khỏi mảng
        const randomIndex = Math.floor(Math.random() * customers.length);
        selectedCustomer = customers[randomIndex];
        customers.splice(randomIndex, 1); // Xóa khách hàng đã chọn khỏi danh sách

        const digits = String(selectedCustomer.number || '').split(""); // Tách số thành mảng chữ số

        const boxes = document.querySelectorAll(".box");
        // Nếu hiện có ít ô hơn chữ số của mã, tạo thêm ô tương ứng
        if (digits.length > boxes.length) {
            createBoxes(digits.length);
        }

        const currentBoxes = document.querySelectorAll(".box");

        // Phát nhạc khi bắt đầu quay
        spinSound.play();

        for (let i = 0; i < digits.length; i++) {
            const box = currentBoxes[i];
            if (!box) continue;
            box.classList.add("active");

            // Slow down the last box
            if (i === digits.length - 1) {
                await spinBox(box, digits[i], 250); // Increase delay for last box
            } else {
                await spinBox(box, digits[i], delay); // Regular delay for other boxes
            }
            
            box.classList.remove("active");
        }

        // Dừng nhạc khi quay xong
        spinSound.pause();
        spinSound.currentTime = 0;

        // Lưu kết quả vào file JSON và hiển thị trên bảng
        await saveResult(selectedCustomer);
        addResultToTable(selectedCustomer, resultCounter++);

        // Phát âm thanh trúng thưởng
        winSound.play();

        // Hiển thị hiệu ứng nổ pháo ăn mừng
        showCelebration();

        // Hiển thị popup với số trúng giải
        winningNumberElement.textContent = `${selectedCustomer.name} - ${selectedCustomer.number}`;
        popup.style.display = "flex"; // Hiển thị popup

        // Enable lại nút quay sau khi quay xong
        startButton.disabled = false;
    }

    // Thêm khách hàng trúng vào bảng kết quả
    function addResultToTable(customer, index) {
        const row = document.createElement("tr");
        const sttCell = document.createElement("td");
        const nameCell = document.createElement("td");
        const numberCell = document.createElement("td");

        sttCell.textContent = index;
        nameCell.textContent = customer.name;
        numberCell.textContent = customer.number;

        row.appendChild(sttCell);
        row.appendChild(nameCell);
        row.appendChild(numberCell);
        resultsTable.appendChild(row);
    }

    function renderEmployeesTable(list) {
        if (!employeesTableBody) return;
        employeesTableBody.innerHTML = "";
        list.forEach((customer, index) => {
            const row = document.createElement("tr");
            const stt = document.createElement("td");
            const name = document.createElement("td");
            const number = document.createElement("td");

            stt.textContent = index + 1;
            name.textContent = customer.name;
            number.textContent = customer.number;

            row.appendChild(stt);
            row.appendChild(name);
            row.appendChild(number);
            employeesTableBody.appendChild(row);
        });
    }

    // Xóa bảng kết quả
    function resetTable() {
        resultsTable.innerHTML = "";
        resultCounter = 1;
    }

    // Hiển thị hiệu ứng pháo bông ăn mừng
    function showCelebration() {
        confetti({
            particleCount: 200,
            spread: 70,
            origin: { x: 0.5, y: 0.5 },
            zIndex: 9999, // Đảm bảo hiệu ứng pháo bông đè lên popup
        });
    }

    // Đóng popup
    closePopupButton.addEventListener("click", () => {
        popup.style.display = "none"; // Ẩn popup
    });

    if (employeesButton && employeesModal && closeEmployeesButton) {
        employeesButton.addEventListener("click", () => {
            // Hiển thị danh sách ban đầu (toàn bộ nhân viên)
            renderEmployeesTable(allCustomers);
            employeesModal.classList.add("open");
        });

        closeEmployeesButton.addEventListener("click", () => {
            employeesModal.classList.remove("open");
        });

        employeesModal.addEventListener("click", (event) => {
            if (event.target === employeesModal) {
                employeesModal.classList.remove("open");
            }
        });
    }

    // Force update data from sheet / fallback sources
    if (forceUpdateButton) {
        forceUpdateButton.addEventListener("click", async () => {
            forceUpdateButton.disabled = true;
            const originalText = forceUpdateButton.textContent;
            forceUpdateButton.textContent = "Đang cập nhật...";
            try {
                await fetchCustomers();
                // If employees modal is open, refresh its content
                if (employeesModal && employeesModal.classList.contains("open")) {
                    renderEmployeesTable(customers);
                }

                // Recreate boxes if new data contains longer numbers
                if (allCustomers && allCustomers.length) {
                    const lengths = allCustomers.map(c => String(c.number || '').length || 1);
                    const m = Math.max(...lengths);
                    if (Number.isFinite(m) && m > 0) createBoxes(m);
                }
                alert("Dữ liệu đã được cập nhật");
            } catch (err) {
                console.error('Force update failed', err);
                alert("Cập nhật thất bại: " + (err && err.message ? err.message : err));
            } finally {
                forceUpdateButton.disabled = false;
                forceUpdateButton.textContent = originalText;
            }
        });
    }

    // Gắn sự kiện cho nút bấm
    startButton.addEventListener("click", spinBoxesSequentially);
    clearButton.addEventListener("click", async () => {
        await clearResults();
        resetTable();
        // Khôi phục danh sách khách hàng còn lại về toàn bộ danh sách gốc
        customers = [...allCustomers];
        renderEmployeesTable(customers);
        resetBoxes();
    });

    // Khởi tạo game
    async function init() {
        await fetchCustomers();
        await loadResults();

        // Tạo số ô dựa trên độ dài mã dài nhất (hoặc 10 nếu không có dữ liệu)
        let maxDigits = 10;
        if (allCustomers && allCustomers.length) {
            const lengths = allCustomers.map(c => String(c.number || '').length || 1);
            const m = Math.max(...lengths);
            if (Number.isFinite(m) && m > 0) maxDigits = m;
        }
        createBoxes(maxDigits);
    }

    init();
});
