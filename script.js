document.addEventListener("DOMContentLoaded", () => {
    const boxContainer = document.getElementById("box-container");
    const startButton = document.getElementById("start-button");
    const clearButton = document.getElementById("clear-button");
    const resultsTable = document.getElementById("results-table").querySelector("tbody");
    const popup = document.getElementById("popup");
    const winningNumberElement = document.getElementById("winning-number");
    const closePopupButton = document.getElementById("close-popup");
    const spinSound = document.getElementById("spin-sound"); // Đối tượng âm thanh quay số
    const winSound = document.getElementById("win-sound"); // Đối tượng âm thanh trúng thưởng

    const delay = 50; // Độ trễ khi quay (ms)
    let customers = []; // Mảng chứa khách hàng
    let selectedCustomer = {}; // Khách hàng được chọn
    let resultCounter = 1; // Đếm số kết quả đã trúng

    // Tạo các ô số
    function createBoxes() {
        for (let i = 0; i < 10; i++) {
            const box = document.createElement("div");
            box.classList.add("box");
            box.textContent = "?";
            boxContainer.appendChild(box);
        }
    }

    // Đọc dữ liệu khách hàng từ file JSON
    async function fetchCustomers() {
        const response = await fetch("data.json");
        const data = await response.json();
        customers = [...data.customers];
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

        const digits = selectedCustomer.number.split(""); // Tách số thành mảng chữ số

        const boxes = document.querySelectorAll(".box");

        // Phát nhạc khi bắt đầu quay
        spinSound.play();

        for (let i = 0; i < digits.length; i++) {
            const box = boxes[i];
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

    // Gắn sự kiện cho nút bấm
    startButton.addEventListener("click", spinBoxesSequentially);
    clearButton.addEventListener("click", async () => {
        await clearResults();
        resetTable();
        resetBoxes();
    });

    // Khởi tạo game
    async function init() {
        createBoxes();
        await fetchCustomers();
        await loadResults();
    }

    init();
});
