(function () {
    'use strict';

    // --- Данные ---
    var transactions = [];
    var startAmount = 0;

    // Загрузка с сервера при старте
    function loadData() {
        return fetch('/api/data')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                transactions = data.transactions || [];
                startAmount = data.startAmount || 0;
            })
            .catch(function () {
                // Фоллбэк на localStorage если сервер недоступен
                try {
                    transactions = JSON.parse(localStorage.getItem('traty_transactions')) || [];
                } catch { transactions = []; }
                startAmount = parseFloat(localStorage.getItem('traty_start_amount')) || 0;
            });
    }

    // --- API запросы ---
    function apiAddTransaction(t) {
        return fetch('/api/transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(t)
        }).then(function (r) { return r.json(); }).then(function (res) {
            t.id = res.id;
            // Дублируем в localStorage как бэкап
            localStorage.setItem('traty_transactions', JSON.stringify(transactions));
            return res;
        }).catch(function () {
            localStorage.setItem('traty_transactions', JSON.stringify(transactions));
        });
    }

    function apiDeleteTransaction(id) {
        return fetch('/api/transaction/' + id, {
            method: 'DELETE'
        }).then(function () {
            localStorage.setItem('traty_transactions', JSON.stringify(transactions));
        }).catch(function () {
            localStorage.setItem('traty_transactions', JSON.stringify(transactions));
        });
    }

    function apiSetStartAmount(amount) {
        return fetch('/api/start-amount', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amount })
        }).then(function () {
            localStorage.setItem('traty_start_amount', amount);
        }).catch(function () {
            localStorage.setItem('traty_start_amount', amount);
        });
    }

    // --- Навигация ---
    var navBtns = document.querySelectorAll('.nav-btn');
    var screens = document.querySelectorAll('.screen');

    function showScreen(name) {
        screens.forEach(function (s) { s.classList.remove('active'); });
        navBtns.forEach(function (b) { b.classList.remove('active'); });
        document.getElementById('screen-' + name).classList.add('active');
        document.querySelector('.nav-btn[data-screen="' + name + '"]').classList.add('active');

        if (name === 'balance') renderBalance();
    }

    navBtns.forEach(function (btn) {
        btn.addEventListener('click', function () { showScreen(btn.dataset.screen); });
    });

    // --- Дата ---
    function todayStr() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    document.getElementById('expense-date').value = todayStr();
    document.getElementById('income-date').value = todayStr();

    // --- Цифровая клавиатура ---
    function Numpad(containerId, amountId, onSubmit, animClass) {
        this.container = document.getElementById(containerId);
        this.amountEl = document.getElementById(amountId);
        this.onSubmit = onSubmit;
        this.animClass = animClass;
        this.value = '';

        var self = this;
        this.container.querySelectorAll('.numpad-btn').forEach(function (btn) {
            btn.addEventListener('click', function () { self.handleKey(btn.dataset.val); });
        });
    }

    Numpad.prototype.handleKey = function (val) {
        if (val === 'back') {
            this.value = this.value.slice(0, -1);
        } else if (val === 'ok') {
            if (this.value && parseFloat(this.value) > 0) {
                var display = this.amountEl.closest('.amount-display');
                var self = this;
                var capturedValue = this.value;
                if (display) {
                    display.classList.add(this.animClass);
                    setTimeout(function () {
                        self.onSubmit(parseFloat(capturedValue));
                        self.value = '';
                        self.render();
                        display.classList.remove(self.animClass);
                    }, 400);
                } else {
                    this.onSubmit(parseFloat(this.value));
                    this.value = '';
                }
            }
            return;
        } else if (val === '.') {
            if (this.value.includes('.')) return;
            if (this.value === '') this.value = '0';
            this.value += '.';
        } else if (val === '000') {
            if (this.value === '' || this.value === '0') return;
            this.value += '000';
        } else {
            if (this.value === '0' && val === '0') return;
            if (this.value === '0') this.value = '';
            var dotIdx = this.value.indexOf('.');
            if (dotIdx !== -1 && this.value.length - dotIdx > 2) return;
            this.value += val;
        }
        this.render();
    };

    Numpad.prototype.render = function () {
        if (this.value === '') {
            this.amountEl.textContent = '0';
        } else {
            this.amountEl.textContent = formatInput(this.value);
        }
    };

    // --- Трата ---
    var numpadExpense = new Numpad('numpad-expense', 'expense-amount-text', function (amount) {
        var t = {
            id: Date.now(),
            type: 'expense',
            amount: amount,
            date: document.getElementById('expense-date').value,
            note: document.getElementById('expense-note').value.trim()
        };
        transactions.push(t);
        apiAddTransaction(t);

        document.getElementById('expense-note').value = '';
        document.getElementById('expense-date').value = todayStr();
        showToast('−' + formatMoney(amount) + ' ₽', 'expense');
    }, 'drop-down');

    // --- Доход ---
    var numpadIncome = new Numpad('numpad-income', 'income-amount-text', function (amount) {
        var t = {
            id: Date.now(),
            type: 'income',
            amount: amount,
            date: document.getElementById('income-date').value,
            note: document.getElementById('income-note').value.trim()
        };
        transactions.push(t);
        apiAddTransaction(t);

        document.getElementById('income-note').value = '';
        document.getElementById('income-date').value = todayStr();
        showToast('+' + formatMoney(amount) + ' ₽', 'income');
    }, 'fly-up');

    // --- Экран остатка ---
    var inputStartAmount = document.getElementById('input-start-amount');
    var btnSetStart = document.getElementById('btn-set-start');

    btnSetStart.addEventListener('click', function () {
        var val = parseFloat(inputStartAmount.value);
        if (!val || val < 0) return;
        startAmount = val;
        apiSetStartAmount(startAmount);
        inputStartAmount.value = '';
        renderBalance();
        showToast('Начальная сумма: ' + formatMoney(startAmount) + ' ₽');
    });

    // --- Сброс начальной суммы ---
    var btnResetStart = document.getElementById('btn-reset-start');
    btnResetStart.addEventListener('click', function () {
        startAmount = 0;
        apiSetStartAmount(0);
        inputStartAmount.value = '';
        renderBalance();
        showToast('Начальная сумма сброшена');
    });

    var viewYear = new Date().getFullYear();
    var viewMonth = new Date().getMonth();

    function renderBalance() {
        var list = document.getElementById('balance-list');
        var summary = document.getElementById('balance-card');

        var monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

        var filtered = transactions.filter(function (t) {
            var d = new Date(t.date);
            return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
        });

        var totalIncomeAll = transactions.filter(function (t) { return t.type === 'income'; }).reduce(function (s, t) { return s + t.amount; }, 0);
        var totalExpenseAll = transactions.filter(function (t) { return t.type === 'expense'; }).reduce(function (s, t) { return s + t.amount; }, 0);
        var balance = startAmount + totalIncomeAll - totalExpenseAll;

        var monthIncome = filtered.filter(function (t) { return t.type === 'income'; }).reduce(function (s, t) { return s + t.amount; }, 0);
        var monthExpense = filtered.filter(function (t) { return t.type === 'expense'; }).reduce(function (s, t) { return s + t.amount; }, 0);

        summary.innerHTML =
            '<div class="summary-label">Остаток</div>' +
            '<div class="balance-amount ' + (balance >= 0 ? 'positive' : 'negative') + '">' + formatMoney(balance) + ' ₽</div>' +
            '<div class="summary-start-row">' +
                '<span class="summary-income-label">Начальная сумма</span>' +
                '<span class="summary-start-value">' + formatMoney(startAmount) + ' ₽</span>' +
            '</div>' +
            '<div class="summary-row">' +
                '<span class="summary-income-label">Доходы всего</span>' +
                '<span class="summary-income">+' + formatMoney(totalIncomeAll) + ' ₽</span>' +
            '</div>' +
            '<div class="summary-row">' +
                '<span class="summary-expense-label">Траты всего</span>' +
                '<span class="summary-expense">−' + formatMoney(totalExpenseAll) + ' ₽</span>' +
            '</div>' +
            '<div class="summary-row" style="margin-top:12px;border-top:0.5px solid var(--separator);padding-top:10px;">' +
                '<span class="summary-expense-label">' + monthNames[viewMonth] + '</span>' +
                '<span></span>' +
            '</div>' +
            '<div class="summary-row">' +
                '<span class="summary-income-label">Доходы</span>' +
                '<span class="summary-income">+' + formatMoney(monthIncome) + ' ₽</span>' +
            '</div>' +
            '<div class="summary-row">' +
                '<span class="summary-expense-label">Траты</span>' +
                '<span class="summary-expense">−' + formatMoney(monthExpense) + ' ₽</span>' +
            '</div>';

        var monthNav = document.createElement('div');
        monthNav.className = 'month-nav';
        monthNav.innerHTML =
            '<button id="btn-prev-month">◀</button>' +
            '<span class="month-title">' + monthNames[viewMonth] + ' ' + viewYear + '</span>' +
            '<button id="btn-next-month">▶</button>';

        var oldNav = list.parentElement.querySelector('.month-nav');
        if (oldNav) oldNav.remove();
        list.parentElement.insertBefore(monthNav, list);

        document.getElementById('btn-prev-month').addEventListener('click', function () {
            viewMonth--;
            if (viewMonth < 0) { viewMonth = 11; viewYear--; }
            renderBalance();
        });
        document.getElementById('btn-next-month').addEventListener('click', function () {
            viewMonth++;
            if (viewMonth > 11) { viewMonth = 0; viewYear++; }
            renderBalance();
        });

        if (filtered.length === 0) {
            list.innerHTML = '<div class="empty">Нет записей за этот месяц</div>';
            return;
        }

        var sorted = filtered.slice().sort(function (a, b) { return b.date.localeCompare(a.date) || b.id - a.id; });

        list.innerHTML = sorted.map(function (t) {
            var isExpense = t.type === 'expense';
            return '<div class="transaction-item">' +
                '<div class="transaction-info">' +
                    '<div class="transaction-title">' + (t.note ? esc(t.note) : (isExpense ? 'Трата' : 'Доход')) + '</div>' +
                    '<div class="transaction-meta">' + formatDate(t.date) + '</div>' +
                '</div>' +
                '<div class="transaction-amount ' + t.type + '">' + (isExpense ? '−' : '+') + formatMoney(t.amount) + ' ₽</div>' +
                '<button class="transaction-delete" data-id="' + t.id + '">✕</button>' +
            '</div>';
        }).join('');

        list.querySelectorAll('.transaction-delete').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var id = Number(btn.dataset.id);
                transactions = transactions.filter(function (t) { return t.id !== id; });
                apiDeleteTransaction(id);
                renderBalance();
                showToast('Удалено');
            });
        });
    }

    // --- История (модальное окно) ---
    var historyModal = document.getElementById('history-modal');
    var historyTitle = document.getElementById('history-title');
    var historyList = document.getElementById('history-list');
    var historyTotal = document.getElementById('history-total');
    var btnCloseHistory = document.getElementById('btn-close-history');

    function openHistory(type) {
        var isExpense = type === 'expense';
        historyTitle.textContent = isExpense ? 'История трат' : 'История доходов';

        var filtered = transactions.filter(function (t) { return t.type === type; });
        var total = filtered.reduce(function (s, t) { return s + t.amount; }, 0);

        historyTotal.className = 'modal-total ' + type;
        historyTotal.textContent = (isExpense ? '−' : '+') + formatMoney(total) + ' ₽';

        if (filtered.length === 0) {
            historyList.innerHTML = '<div class="empty">Нет записей</div>';
        } else {
            var sorted = filtered.slice().sort(function (a, b) { return b.date.localeCompare(a.date) || b.id - a.id; });
            historyList.innerHTML = sorted.map(function (t) {
                var isExp = t.type === 'expense';
                return '<div class="transaction-item">' +
                    '<div class="transaction-info">' +
                        '<div class="transaction-title">' + (t.note ? esc(t.note) : (isExp ? 'Трата' : 'Доход')) + '</div>' +
                        '<div class="transaction-meta">' + formatDate(t.date) + '</div>' +
                    '</div>' +
                    '<div class="transaction-amount ' + t.type + '">' + (isExp ? '−' : '+') + formatMoney(t.amount) + ' ₽</div>' +
                    '<button class="transaction-delete" data-id="' + t.id + '">✕</button>' +
                '</div>';
            }).join('');

            historyList.querySelectorAll('.transaction-delete').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var id = Number(btn.dataset.id);
                    transactions = transactions.filter(function (t) { return t.id !== id; });
                    apiDeleteTransaction(id);
                    openHistory(type);
                    showToast('Удалено');
                });
            });
        }

        historyModal.classList.add('open');
    }

    function closeHistory() {
        historyModal.classList.remove('open');
        renderBalance();
    }

    btnCloseHistory.addEventListener('click', closeHistory);
    historyModal.addEventListener('click', function (e) {
        if (e.target === historyModal) closeHistory();
    });

    document.querySelectorAll('.btn-history').forEach(function (btn) {
        btn.addEventListener('click', function () { openHistory(btn.dataset.type); });
    });

    // --- Общая история (с экрана остатка) ---
    var balanceHistModal = document.getElementById('balance-history-modal');
    var balanceHistList = document.getElementById('balance-history-list');
    var balanceHistIncome = document.getElementById('balance-hist-income');
    var balanceHistExpense = document.getElementById('balance-hist-expense');
    var btnCloseBalanceHist = document.getElementById('btn-close-balance-history');

    function openBalanceHistory() {
        var totalInc = transactions.filter(function (t) { return t.type === 'income'; }).reduce(function (s, t) { return s + t.amount; }, 0);
        var totalExp = transactions.filter(function (t) { return t.type === 'expense'; }).reduce(function (s, t) { return s + t.amount; }, 0);

        balanceHistIncome.textContent = '+' + formatMoney(totalInc) + ' ₽';
        balanceHistExpense.textContent = '−' + formatMoney(totalExp) + ' ₽';

        if (transactions.length === 0) {
            balanceHistList.innerHTML = '<div class="empty">Нет записей</div>';
        } else {
            var sorted = transactions.slice().sort(function (a, b) { return b.date.localeCompare(a.date) || b.id - a.id; });
            balanceHistList.innerHTML = sorted.map(function (t) {
                var isExp = t.type === 'expense';
                return '<div class="transaction-item">' +
                    '<div class="transaction-info">' +
                        '<div class="transaction-title">' + (t.note ? esc(t.note) : (isExp ? 'Трата' : 'Доход')) + '</div>' +
                        '<div class="transaction-meta">' + formatDate(t.date) + '</div>' +
                    '</div>' +
                    '<div class="transaction-amount ' + t.type + '">' + (isExp ? '−' : '+') + formatMoney(t.amount) + ' ₽</div>' +
                    '<button class="transaction-delete" data-id="' + t.id + '">✕</button>' +
                '</div>';
            }).join('');

            balanceHistList.querySelectorAll('.transaction-delete').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var id = Number(btn.dataset.id);
                    transactions = transactions.filter(function (t) { return t.id !== id; });
                    apiDeleteTransaction(id);
                    openBalanceHistory();
                    showToast('Удалено');
                });
            });
        }

        balanceHistModal.classList.add('open');
    }

    function closeBalanceHistory() {
        balanceHistModal.classList.remove('open');
        renderBalance();
    }

    document.getElementById('btn-balance-history').addEventListener('click', openBalanceHistory);
    btnCloseBalanceHist.addEventListener('click', closeBalanceHistory);
    balanceHistModal.addEventListener('click', function (e) {
        if (e.target === balanceHistModal) closeBalanceHistory();
    });

    // --- График ---
    var chartModal = document.getElementById('chart-modal');
    var btnChart = document.getElementById('btn-chart');
    var btnCloseChart = document.getElementById('btn-close-chart');

    function openChart() {
        var totalIncome = startAmount + transactions.filter(function (t) { return t.type === 'income'; }).reduce(function (s, t) { return s + t.amount; }, 0);
        var totalExpense = transactions.filter(function (t) { return t.type === 'expense'; }).reduce(function (s, t) { return s + t.amount; }, 0);
        var maxVal = Math.max(totalIncome, totalExpense, 1);
        var maxHeight = 280;

        document.getElementById('chart-bar-income').style.height = Math.round((totalIncome / maxVal) * maxHeight) + 'px';
        document.getElementById('chart-bar-expense').style.height = Math.round((totalExpense / maxVal) * maxHeight) + 'px';
        document.getElementById('chart-income-val').textContent = '+' + formatMoney(totalIncome) + ' ₽';
        document.getElementById('chart-expense-val').textContent = '−' + formatMoney(totalExpense) + ' ₽';

        chartModal.classList.add('open');
    }

    function closeChart() {
        chartModal.classList.remove('open');
    }

    btnChart.addEventListener('click', openChart);
    btnCloseChart.addEventListener('click', closeChart);
    chartModal.addEventListener('click', function (e) {
        if (e.target === chartModal) closeChart();
    });

    // --- Утилиты ---
    function formatMoney(n) {
        var str = n.toFixed(2).replace(/\.?0+$/, '');
        var parts = str.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        return parts.join('.');
    }

    function formatInput(val) {
        var parts = val.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        return parts.join('.');
    }

    function formatDate(dateStr) {
        var p = dateStr.split('-');
        var y = p[0], m = p[1], d = p[2];
        var mn = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
        return Number(d) + ' ' + mn[Number(m) - 1] + ' ' + y;
    }

    function esc(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showToast(msg, type) {
        var toast = document.querySelector('.toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.className = 'toast show' + (type === 'expense' ? ' toast-expense' : '');
        setTimeout(function () { toast.classList.remove('show'); }, 1500);
    }

    // --- Старт: загрузка данных с сервера ---
    loadData().then(function () {
        renderBalance();
    });
})();