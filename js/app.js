// ITS POWER BI 人工智慧核心能力模擬試題復習系統
(function () {
    'use strict';

    // 全局變數
    let questions = [];
    let testQuestions = [];
    let currentQuestionIndex = 0;
    let userAnswers = [];
    let startTime = null;
    let timerInterval = null;
    let testTimeLimit = 60; // 分鐘
    let soundEnabled = true;
    let answerOrderRandom = false;

    // 音效物件
    const sounds = {
        success: new Audio('sounds/success.mp3'),
        error: new Audio('sounds/error.mp3')
    };

    // DOM 元素
    const elements = {
        // 設置頁面
        setupScreen: document.getElementById('setupScreen'),
        rangeStart: document.getElementById('rangeStart'),
        rangeEnd: document.getElementById('rangeEnd'),
        questionCount: document.getElementById('questionCount'),
        quickSelect: document.getElementById('quickSelect'),
        answerOrder: document.getElementById('answerOrder'),
        testTime: document.getElementById('testTime'),
        soundEnabled: document.getElementById('soundEnabled'),
        startTest: document.getElementById('startTest'),
        previewQuestions: document.getElementById('previewQuestions'),
        downloadQuestions: document.getElementById('downloadQuestions'),
        weightedQuestions: document.getElementById('weightedQuestions'),

        // 測驗頁面
        testScreen: document.getElementById('testScreen'),
        questionNumber: document.getElementById('questionNumber'),
        progress: document.getElementById('progress'),
        timer: document.getElementById('timer'),
        timerLabel: document.getElementById('timerLabel'),
        questionType: document.getElementById('questionType'),
        questionText: document.getElementById('questionText'),
        questionImage: document.getElementById('questionImage'),
        options: document.getElementById('options'),
        submitAnswer: document.getElementById('submitAnswer'),
        nextQuestion: document.getElementById('nextQuestion'),
        feedback: document.getElementById('feedback'),
        questionNav: document.getElementById('questionNav'),
        submitTest: document.getElementById('submitTest'),
        restartSetup: document.getElementById('restartSetup'),

        // 結果頁面
        resultScreen: document.getElementById('resultScreen'),
        scoreCircle: document.getElementById('scoreCircle'),
        scoreText: document.getElementById('scoreText'),
        scoreValue: document.getElementById('scoreValue'),
        accuracyValue: document.getElementById('accuracyValue'),
        timeValue: document.getElementById('timeValue'),
        wrongAnswers: document.getElementById('wrongAnswers'),
        retakeTest: document.getElementById('retakeTest'),

        // Modal
        modal: document.getElementById('modal'),
        modalBody: document.getElementById('modalBody')
    };

    // 初始化
    async function init() {
        try {
            await loadQuestions();
            setupEventListeners();
            preloadSounds();
        } catch (error) {
            console.error('初始化失敗:', error);
            alert('系統初始化失敗,請確認題庫檔案是否存在。\n\n提示:如果直接用瀏覽器開啟檔案,可能會遇到CORS限制。\n建議使用本地伺服器(如 VS Code Live Server)來執行。');
        }
    }

    // 載入題庫
    async function loadQuestions() {
        try {
            const response = await fetch('data/questions.json');
            if (!response.ok) {
                throw new Error('題庫載入失敗');
            }
            questions = await response.json();

            // 確保每個題目都有 weight 屬性
            // 正規化題目資料：補 weight，並將答案從字母(A/B/...)轉為 1-based 數字索引
            questions = questions.map(q => {
                const normalized = {
                    ...q,
                    weight: q.weight || 1
                };

                // normalize answer: 支援數字或字母形式 (如 "A","B"), 最後轉為數字 1-based
                if (Array.isArray(normalized.answer)) {
                    normalized.answer = normalized.answer.map(a => {
                        if (typeof a === 'number') return a;
                        if (typeof a === 'string') {
                            const trimmed = a.trim();
                            // 若為單一字母 A~Z
                            if (/^[A-Za-z]$/.test(trimmed)) {
                                return trimmed.toUpperCase().charCodeAt(0) - 65 + 1; // A -> 1
                            }
                            // 若為數字字串
                            const n = parseInt(trimmed, 10);
                            if (!isNaN(n)) return n;
                        }
                        return a; // fallback 保持原樣
                    }).filter(x => x !== undefined && x !== null);
                }

                return normalized;
            });

            elements.rangeEnd.value = questions.length;
            elements.rangeEnd.max = questions.length;

            console.log(`成功載入 ${questions.length} 題`);
        } catch (error) {
            throw new Error('題庫載入失敗: ' + error.message);
        }
    }

    // 預載音效
    function preloadSounds() {
        sounds.success.load();
        sounds.error.load();
    }

    // 播放音效
    function playSound(type) {
        if (!soundEnabled) return;

        try {
            const sound = sounds[type];
            if (sound) {
                sound.currentTime = 0;
                sound.play().catch(err => {
                    console.log('音效播放失敗:', err);
                });
            }
        } catch (error) {
            console.log('音效播放錯誤:', error);
        }
    }

    // 設置事件監聽器
    function setupEventListeners() {
        // 快速選擇題數
        elements.quickSelect.addEventListener('change', function () {
            if (this.value === 'all') {
                elements.questionCount.value = questions.length;
            } else if (this.value) {
                elements.questionCount.value = this.value;
            }
        });

        // 音效開關
        elements.soundEnabled.addEventListener('change', function () {
            soundEnabled = this.checked;
        });

        // 開始測驗
        elements.startTest.addEventListener('click', startTest);

        // 預覽題庫
        elements.previewQuestions.addEventListener('click', previewQuestionsModal);

        // 下載題庫
        elements.downloadQuestions.addEventListener('click', downloadQuestionsJSON);

        // 提交答案
        elements.submitAnswer.addEventListener('click', submitAnswer);

        // 下一題
        elements.nextQuestion.addEventListener('click', nextQuestion);

        // 立即交卷
        elements.submitTest.addEventListener('click', () => {
            if (confirm('確定要立即交卷嗎?')) {
                showResults();
            }
        });

        // 重新開始
        elements.restartSetup.addEventListener('click', () => {
            if (confirm('確定要重新開始嗎?當前進度將會遺失。')) {
                resetTest();
                showScreen('setupScreen');
            }
        });

        // 再考一次
        elements.retakeTest.addEventListener('click', () => {
            resetTest();
            showScreen('setupScreen');
        });

        // Modal 關閉
        document.querySelector('.modal-close').addEventListener('click', closeModal);
        elements.modal.addEventListener('click', function (e) {
            if (e.target === this) {
                closeModal();
            }
        });
    }

    // 開始測驗
    function startTest() {
        const rangeStart = parseInt(elements.rangeStart.value);
        const rangeEnd = parseInt(elements.rangeEnd.value);
        const questionCount = parseInt(elements.questionCount.value);

        // 驗證輸入
        if (rangeStart < 1 || rangeStart > questions.length) {
            alert(`起始題號必須在 1 到 ${questions.length} 之間`);
            return;
        }

        if (rangeEnd < rangeStart || rangeEnd > questions.length) {
            alert(`結束題號必須在 ${rangeStart} 到 ${questions.length} 之間`);
            return;
        }

        if (questionCount < 1) {
            alert('測驗題數必須至少為 1');
            return;
        }

        // 取得範圍內的題目
        const rangeQuestions = questions.slice(rangeStart - 1, rangeEnd);

        // 檢查是否有足夠的題目
        const actualCount = Math.min(questionCount, rangeQuestions.length);
        if (actualCount < questionCount) {
            if (!confirm(`範圍內只有 ${rangeQuestions.length} 題,將進行 ${actualCount} 題測驗。是否繼續?`)) {
                return;
            }
        }

        // 顯示權重題目
        showWeightedQuestions(rangeQuestions);

        // 權重隨機抽題
        testQuestions = weightedRandomSample(rangeQuestions, actualCount);

        // 處理答案順序
        answerOrderRandom = elements.answerOrder.value === 'random';
        if (answerOrderRandom) {
            testQuestions = testQuestions.map(q => ({
                ...q,
                shuffledOptions: shuffleArray([...q.options]),
                optionMapping: getOptionMapping(q.options, shuffleArray([...q.options]))
            }));
        }

        // 設置測驗時間
        testTimeLimit = parseInt(elements.testTime.value);

        // 初始化測驗狀態
        currentQuestionIndex = 0;
        userAnswers = new Array(testQuestions.length).fill(null);
        startTime = Date.now();

        // 生成題號導航
        generateQuestionNavigation();

        // 開始計時
        startTimer();

        // 顯示第一題
        showQuestion(0);

        // 切換到測驗頁面
        showScreen('testScreen');
    }

    // 顯示權重題目
    function showWeightedQuestions(rangeQuestions) {
        const weightedItems = rangeQuestions.filter(q => q.weight > 1);

        if (weightedItems.length === 0) {
            elements.weightedQuestions.classList.add('hidden');
            return;
        }

        // 按權重排序
        weightedItems.sort((a, b) => b.weight - a.weight);

        let html = '<h3>重點題目 (權重 > 1)</h3>';
        weightedItems.forEach(q => {
            const questionPreview = q.question.substring(0, 50) + (q.question.length > 50 ? '...' : '');
            html += `
                <div class="weighted-item">
                    <span class="weight-badge">權重: ${q.weight}</span>
                    <strong>題 ${q.id}:</strong> ${questionPreview}
                </div>
            `;
        });

        elements.weightedQuestions.innerHTML = html;
        elements.weightedQuestions.classList.remove('hidden');
    }

    // 權重隨機抽題
    function weightedRandomSample(array, count) {
        const result = [];
        const pool = [...array];

        for (let i = 0; i < count && pool.length > 0; i++) {
            const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
            let random = Math.random() * totalWeight;

            for (let j = 0; j < pool.length; j++) {
                random -= pool[j].weight;
                if (random <= 0) {
                    result.push(pool[j]);
                    pool.splice(j, 1);
                    break;
                }
            }
        }

        return result;
    }

    // 洗牌算法 (Fisher-Yates)
    function shuffleArray(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    // 取得選項映射
    function getOptionMapping(original, shuffled) {
        const mapping = [];
        shuffled.forEach((option, index) => {
            mapping[index] = original.indexOf(option);
        });
        return mapping;
    }

    // 生成題號導航
    function generateQuestionNavigation() {
        let html = '';
        for (let i = 0; i < testQuestions.length; i++) {
            html += `<button class="nav-btn" data-index="${i}">${i + 1}</button>`;
        }
        elements.questionNav.innerHTML = html;

        // 題號導航點擊事件
        elements.questionNav.addEventListener('click', function (e) {
            if (e.target.classList.contains('nav-btn')) {
                const index = parseInt(e.target.dataset.index);
                showQuestion(index);
            }
        });
    }

    // 更新題號導航狀態
    function updateQuestionNavigation() {
        const navButtons = elements.questionNav.querySelectorAll('.nav-btn');
        navButtons.forEach((btn, index) => {
            btn.classList.remove('current', 'answered');
            if (index === currentQuestionIndex) {
                btn.classList.add('current');
            } else if (userAnswers[index] !== null) {
                btn.classList.add('answered');
            }
        });
    }

    // 顯示題目
    function showQuestion(index) {
        currentQuestionIndex = index;
        const question = testQuestions[index];

        // 更新進度資訊
        elements.questionNumber.textContent = `第 ${index + 1}/${testQuestions.length} 題`;
        const progressPercent = Math.round(((index + 1) / testQuestions.length) * 100);
        elements.progress.textContent = `${progressPercent}%`;

        // 顯示題型
        elements.questionType.textContent = question.type === 'single' ? '單選題' : '複選題';

        // 顯示題目
        elements.questionText.textContent = question.question;

        // 顯示圖片
        if (question.image) {
            elements.questionImage.querySelector('img').src = question.image;
            elements.questionImage.classList.remove('hidden');
        } else {
            elements.questionImage.classList.add('hidden');
        }

        // 顯示選項
        const options = answerOrderRandom ? question.shuffledOptions : question.options;
        let optionsHTML = '';
        const inputType = question.type === 'single' ? 'radio' : 'checkbox';

        options.forEach((option, i) => {
            const optionId = `option-${i}`;
            const label = String.fromCharCode(65 + i); // A, B, C...
            optionsHTML += `
                <label class="option" for="${optionId}">
                    <input type="${inputType}" id="${optionId}" name="answer" value="${i}">
                    <span class="option-text">${label}. ${option}</span>
                </label>
            `;
        });

        elements.options.innerHTML = optionsHTML;

        // 恢復之前的選擇
        if (userAnswers[index] !== null) {
            const selectedValues = userAnswers[index].userSelection;
            selectedValues.forEach(val => {
                const input = elements.options.querySelector(`input[value="${val}"]`);
                if (input) input.checked = true;
            });
        }

        // 重置按鈕狀態
        elements.submitAnswer.classList.remove('hidden');
        elements.nextQuestion.classList.add('hidden');
        elements.feedback.classList.add('hidden');

        // 更新題號導航
        updateQuestionNavigation();

        // 滾動到頂部
        window.scrollTo(0, 0);
    }

    // 提交答案
    function submitAnswer() {
        const question = testQuestions[currentQuestionIndex];
        const selectedInputs = elements.options.querySelectorAll('input:checked');

        if (selectedInputs.length === 0) {
            alert('請選擇答案');
            return;
        }

        // 取得使用者選擇
        let userSelection = Array.from(selectedInputs).map(input => parseInt(input.value));
        userSelection.sort((a, b) => a - b);

        // 如果是隨機順序,需要映射回原始索引
        let mappedSelection = userSelection;
        if (answerOrderRandom) {
            mappedSelection = userSelection.map(i => question.optionMapping[i]);
        }

        // 轉換為 1-based 索引以便比較
        const userAnswer = mappedSelection.map(i => i + 1);
        const correctAnswer = question.answer;

        // 判斷正確性
        const isCorrect = arraysEqual(userAnswer.sort(), correctAnswer.sort());

        // 儲存答案
        userAnswers[currentQuestionIndex] = {
            userSelection: userSelection,
            mappedAnswer: userAnswer,
            isCorrect: isCorrect
        };

        // 顯示反饋
        showFeedback(isCorrect, userAnswer, correctAnswer, question);

        // 播放音效
        playSound(isCorrect ? 'success' : 'error');

        // 禁用選項
        elements.options.querySelectorAll('input').forEach(input => {
            input.disabled = true;
        });
        elements.options.querySelectorAll('.option').forEach(option => {
            option.classList.add('disabled');
        });

        // 切換按鈕
        elements.submitAnswer.classList.add('hidden');
        elements.nextQuestion.classList.remove('hidden');

        // 更新導航狀態
        updateQuestionNavigation();
    }

    // 顯示答題反饋
    function showFeedback(isCorrect, userAnswer, correctAnswer, question) {
        const options = answerOrderRandom ? question.shuffledOptions : question.options;

        let feedbackHTML = '';

        if (isCorrect) {
            feedbackHTML = `
                <div class="feedback-header">
                    <span class="icon">✓</span>
                    <span>答對了!太棒了!</span>
                </div>
            `;
        } else {
            // 使用原始選項(question.options)確保在亂序選項時依舊正確對應
            const userAnswerText = userAnswer.map(i => {
                const label = String.fromCharCode(64 + i); // 1->A
                const text = question.options[i - 1] || '未知';
                return `${label}. ${text}`;
            }).join(', ');

            const correctAnswerText = correctAnswer.map(i => {
                const label = String.fromCharCode(64 + i);
                const text = question.options[i - 1] || '未知';
                return `${label}. ${text}`;
            }).join(', ');

            feedbackHTML = `
                <div class="feedback-header">
                    <span class="icon">✗</span>
                    <span>答錯了,再加油!</span>
                </div>
                <div class="answer-comparison">
                    <p><strong>你的答案:</strong> ${userAnswerText}</p>
                    <p><strong>正確答案:</strong> ${correctAnswerText}</p>
                </div>
            `;
        }

        // 顯示詳細解析
        if (question.explanation) {
            feedbackHTML += `
                <div class="explanation">
                    <h4>詳細解析:</h4>
                    ${question.explanation}
                </div>
            `;
        }

        elements.feedback.innerHTML = feedbackHTML;
        elements.feedback.className = `feedback ${isCorrect ? 'correct' : 'incorrect'}`;
    }

    // 下一題
    function nextQuestion() {
        if (currentQuestionIndex < testQuestions.length - 1) {
            showQuestion(currentQuestionIndex + 1);
        } else {
            // 最後一題
            if (confirm('這是最後一題了。\n\n點擊「確定」交卷查看成績\n點擊「取消」回到第一題繼續練習')) {
                showResults();
            } else {
                showQuestion(0);
            }
        }
    }

    // 開始計時
    function startTimer() {
        const endTime = startTime + testTimeLimit * 60 * 1000;

        timerInterval = setInterval(() => {
            const now = Date.now();
            const remaining = endTime - now;

            if (remaining <= 0) {
                clearInterval(timerInterval);
                alert('時間到!系統將自動交卷。');
                showResults();
                return;
            }

            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            elements.timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

            // 最後一分鐘變紅色
            if (remaining < 60000) {
                elements.timer.style.color = '#dc3545';
            }
        }, 1000);
    }

    // 顯示結果
    function showResults() {
        // 停止計時
        if (timerInterval) {
            clearInterval(timerInterval);
        }

        // 計算成績
        const totalQuestions = testQuestions.length;
        const answeredQuestions = userAnswers.filter(a => a !== null).length;
        const correctCount = userAnswers.filter(a => a && a.isCorrect).length;
        const accuracy = answeredQuestions > 0 ? Math.round((correctCount / answeredQuestions) * 100) : 0;

        // 計算時間
        const elapsedTime = Date.now() - startTime;
        const minutes = Math.floor(elapsedTime / 60000);
        const seconds = Math.floor((elapsedTime % 60000) / 1000);
        const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        // 更新統計資訊
        elements.scoreValue.textContent = `${correctCount}/${answeredQuestions}`;
        elements.accuracyValue.textContent = `${accuracy}%`;
        elements.timeValue.textContent = timeString;
        elements.scoreText.textContent = `${accuracy}%`;

        // 更新圓形圖
        const circumference = 2 * Math.PI * 90;
        const offset = circumference - (accuracy / 100) * circumference;
        elements.scoreCircle.style.strokeDashoffset = offset;

        // 顯示錯題
        showWrongAnswers();

        // 切換到結果頁面
        showScreen('resultScreen');
    }

    // 顯示錯題（含未作答）
    function showWrongAnswers() {
        // 將未作答或答錯的題目都視為錯題複習項
        const wrongItems = userAnswers
            .map((answer, index) => ({ answer, index }))
            .filter(item => item.answer === null || (item.answer && !item.answer.isCorrect));

        if (wrongItems.length === 0) {
            elements.wrongAnswers.innerHTML = '<h2 style="color: #28a745;">恭喜!全部答對!</h2>';
            return;
        }

        let html = '<h2>錯題複習</h2>';

        wrongItems.forEach(item => {
            const question = testQuestions[item.index];
            const answer = item.answer; // 可能為 null (未作答)
            const options = answerOrderRandom ? question.shuffledOptions : question.options;

            // 使用者答案文字（用原始 question.options 來對應正確答案）
            let userAnswerText = '未作答';
            if (answer && Array.isArray(answer.mappedAnswer) && answer.mappedAnswer.length > 0) {
                userAnswerText = answer.mappedAnswer.map(i => {
                    const label = String.fromCharCode(64 + i);
                    const text = question.options[i - 1] || '未知';
                    return `${label}. ${text}`;
                }).join(', ');
            }

            const correctAnswerText = question.answer.map(i => {
                const label = String.fromCharCode(64 + i);
                const text = question.options[i - 1] || '未知';
                return `${label}. ${text}`;
            }).join(', ');

            html += `
                <div class="wrong-item">
                    <div class="question-text">
                        <strong>題 ${item.index + 1} (原題 ${question.id}):</strong> ${question.question}
                    </div>
                    ${question.image ? `<img src="${question.image}" style="max-width: 100%; margin: 10px 0; border-radius: 5px;" alt="題目圖片">` : ''}
                    <div class="options">
                        ${options.map((opt, i) => `<div>${String.fromCharCode(65 + i)}. ${opt}</div>`).join('')}
                    </div>
                    <div class="answer-comparison">
                        <p><strong>你的答案:</strong> ${userAnswerText}</p>
                        <p><strong>正確答案:</strong> ${correctAnswerText}</p>
                    </div>
                    ${question.explanation ? `
                        <div class="explanation">
                            <h4>詳細解析:</h4>
                            ${question.explanation}
                        </div>
                    ` : ''}
                </div>
            `;
        });

        elements.wrongAnswers.innerHTML = html;
    }

    // 預覽題庫
    function previewQuestionsModal() {
        let html = '<h2>題庫預覽</h2>';

        questions.forEach((q, index) => {
            html += `
                <div class="preview-item">
                    <h4>題 ${q.id} ${q.weight > 1 ? `<span class="weight-badge">權重: ${q.weight}</span>` : ''}</h4>
                    <p><strong>題型:</strong> ${q.type === 'single' ? '單選' : '複選'}</p>
                    <p><strong>題目:</strong> ${q.question}</p>
                    <p><strong>選項:</strong></p>
                    <ol>
                        ${q.options.map((opt, idx) => `<li>${String.fromCharCode(65 + idx)}. ${opt}</li>`).join('')}
                    </ol>
                    <p><strong>正確答案:</strong> ${q.answer.map(a => `${String.fromCharCode(64 + a)}. ${q.options[a - 1]}`).join(', ')}</p>
                    ${q.explanation ? `<p><strong>解析:</strong> ${q.explanation}</p>` : ''}
                </div>
            `;
        });

        elements.modalBody.innerHTML = html;
        elements.modal.classList.remove('hidden');
    }

    // 下載題庫
    function downloadQuestionsJSON() {
        const dataStr = JSON.stringify(questions, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'questions.json';
        link.click();
        URL.revokeObjectURL(url);
    }

    // 關閉 Modal
    function closeModal() {
        elements.modal.classList.add('hidden');
    }

    // 顯示指定頁面
    function showScreen(screenName) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        elements[screenName].classList.add('active');
    }

    // 重置測驗
    function resetTest() {
        if (timerInterval) {
            clearInterval(timerInterval);
        }
        testQuestions = [];
        currentQuestionIndex = 0;
        userAnswers = [];
        startTime = null;
        elements.weightedQuestions.classList.add('hidden');
    }

    // 陣列比較
    function arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }
        return true;
    }

    // 啟動應用
    init();
})();
