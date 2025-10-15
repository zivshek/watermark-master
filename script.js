// Removed i18n imports - using Chinese only
import JSZip from 'https://jspm.dev/jszip';
import FileSaver from 'https://jspm.dev/file-saver';

const imageInput = document.getElementById('imageInput');
let lastUploadDirectory = null; // Store the last upload directory path
const watermarkText = document.getElementById('watermarkText');
const watermarkDensity = document.getElementById('watermarkDensity');
const watermarkColor = document.getElementById('watermarkColor');
const watermarkSize = document.getElementById('watermarkSize');
const processButton = document.getElementById('processButton');
const previewContainer = document.getElementById('previewContainer');
const colorPreview = document.getElementById('colorPreview');
const colorPicker = document.getElementById('colorPicker');
const imageModal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const processingLoader = document.getElementById('processingLoader');
const imagePreviewArea = document.getElementById('imagePreviewArea');
const resetButton = document.getElementById('resetButton');
let uploadedFiles = []; // 用于存储已上传的文件
const downloadAllButton = document.getElementById('downloadAllButton');
const resultSection = document.getElementById('resultSection');
const watermarkPosition = document.getElementById('watermarkPosition');

// 添加 Toast 管理器
const ToastManager = {
    container: null,
    queue: [],

    initialize() {
        // 创建 Toast 容器
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
    },

    show(message, type = 'info', duration = 3000, isInline = false, targetElement = null) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        if (isInline && targetElement) {
            // 创建内联提示
            const warningDiv = document.createElement('div');
            warningDiv.className = 'inline-warning';
            warningDiv.textContent = message;

            // 插入到目标元素后面
            targetElement.parentNode.insertBefore(warningDiv, targetElement.nextSibling);

            // 添加显示类
            setTimeout(() => warningDiv.classList.add('show'), 10);

            // 设置定时移除
            setTimeout(() => {
                warningDiv.classList.remove('show');
                setTimeout(() => warningDiv.remove(), 300);
            }, duration);

            return;
        }

        // 添加到容器
        this.container.appendChild(toast);

        // 触发重排以启动动画
        toast.offsetHeight;
        toast.classList.add('show');

        // 设置定时移除
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    showWarning(message, targetElement = null) {
        this.show(message, 'warning', 3000, true, targetElement);
    },

    showError(message, targetElement = null) {
        this.show(message, 'error', 3000, true, targetElement);
    }
};

// 添加输入警告状态管理
function showInputWarning(input, message) {
    input.classList.add('input-warning');

    // 移除现有的警告文本
    const existingWarning = input.parentNode.querySelector('.warning-text');
    if (existingWarning) {
        existingWarning.remove();
    }

    // 创建新的警告文本
    const warningText = document.createElement('div');
    warningText.className = 'warning-text';
    warningText.textContent = message;
    input.parentNode.appendChild(warningText);

    // 触发动画
    setTimeout(() => warningText.classList.add('show'), 10);

    // 设置自动移除
    setTimeout(() => {
        input.classList.remove('input-warning');
        warningText.classList.remove('show');
        setTimeout(() => warningText.remove(), 300);
    }, 3000);
}

function initializeColorInput() {
    const initialColor = '#dedede';
    watermarkColor.value = initialColor;
    colorPicker.value = initialColor;
    colorPreview.style.backgroundColor = initialColor;
}

// 将所有初始化和事件监听器的设置放个函数中
async function initialize() {
    try {
        // 等待所有模块加载完成
        await Promise.all([
            import('https://jspm.dev/jszip'),
            import('https://jspm.dev/file-saver')
        ]);

        initializeColorInput();
        initializeFileInput();
        watermarkColor.addEventListener('input', updateColorPreview);
        colorPreview.addEventListener('click', () => colorPicker.click());
        colorPicker.addEventListener('input', () => {
            watermarkColor.value = colorPicker.value;
            updateColorPreview();
        });
        imageModal.addEventListener('click', function () {
            console.log('Modal clicked');
            this.classList.add('hidden');
        });

        // Language initialization removed - Chinese only

        // 修改这部分代码
        const pasteArea = document.getElementById('pasteArea');
        const imageInput = document.getElementById('imageInput');

        // 点击上传文件
        pasteArea.addEventListener('click', () => imageInput.click());

        // 粘贴处理
        pasteArea.addEventListener('paste', handlePaste);
        document.addEventListener('paste', handlePaste);

        // 文件选择处理
        imageInput.addEventListener('change', handleFileSelect);

        // 拖拽相关事件处理
        pasteArea.addEventListener('dragenter', handleDragEnter);
        pasteArea.addEventListener('dragover', handleDragOver);
        pasteArea.addEventListener('dragleave', handleDragLeave);
        pasteArea.addEventListener('drop', handleDrop);

        // 防止拖拽文件时浏览器打开文件
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        resetButton.addEventListener('click', resetAll);
        downloadAllButton.addEventListener('click', downloadAllImages);

        updateImagePreview();
        handleMobileInteraction();
        window.addEventListener('resize', handleMobileInteraction);

        const watermarkPosition = document.getElementById('watermarkPosition');
        watermarkPosition.addEventListener('change', toggleWatermarkDensity);

        // 初始调用一次，以设置初始状态
        toggleWatermarkDensity();
        updateWatermarkDensityOptions(false);

        // 添加水印文本输入框的事件监听
        const watermarkTextArea = document.getElementById('watermarkText');

        // 添加自动调整高度的函数
        function adjustTextareaHeight(textarea) {
            const paddingY = 8; // 上下内边距（与 py-2 对应）
            const baseHeight = 38; // 单行时的总高度
            const lines = textarea.value.split('\n').length;

            if (lines === 1) {
                textarea.style.height = `${baseHeight}px`;
            } else {
                // 多行时，每增加一行增加 22px
                const additionalHeight = (lines - 1) * 22;
                textarea.style.height = `${baseHeight + additionalHeight}px`;
            }
        }

        // 在 initialize 函数中添加
        const reuseWatermarkBtn = document.getElementById('reuseWatermark');
        const previousWatermarkText = document.getElementById('previousWatermarkText');

        // 加载保存的设置
        function loadSavedSettings() {
            const lastSettings = localStorage.getItem('lastWatermarkSettings');
            console.log('加载历史水印设置:', lastSettings);
            if (lastSettings) {
                const settings = JSON.parse(lastSettings);

                // 先设置位置，这会触发密度选项的更新
                watermarkPosition.value = settings.position;
                toggleWatermarkDensity();

                // 然后设置其他值
                watermarkText.value = settings.text;
                watermarkDensity.value = settings.density;
                watermarkColor.value = settings.color;
                watermarkSize.value = settings.size;
                watermarkOpacity.value = settings.opacity;

                // 更新UI状态
                adjustTextareaHeight(watermarkText);
                updateColorPreview();

                // 处理长文本，最多显示10个字符
                const displayText = settings.text.length > 10
                    ? settings.text.substring(0, 10) + '...'
                    : settings.text;

                // 设置显示文本
                previousWatermarkText.textContent = displayText;
                // 设置完整文本作为title属性，鼠标悬停时显示
                previousWatermarkText.title = `文字: ${settings.text}
位置: ${settings.position}
密度: ${settings.density}
颜色: ${settings.color}
字号: ${settings.size}%
透明度: ${settings.opacity}%`;

                // 添加样式
                previousWatermarkText.className = 'ml-1 truncate max-w-[150px] inline-block align-middle';

                reuseWatermarkBtn.classList.remove('hidden');
                console.log('显示重用按钮');
            } else {
                reuseWatermarkBtn.classList.add('hidden');
                console.log('隐藏重用按钮');
            }
        }

        // 点击重用按钮时的处理
        reuseWatermarkBtn.addEventListener('click', loadSavedSettings);

        // 初始加载保存的设置
        loadSavedSettings();

        // 初始化 Toast 管理器
        ToastManager.initialize();

        // 初始化完成，隐藏加载器
        const pageLoader = document.getElementById('pageLoader');
        if (pageLoader) {
            pageLoader.style.display = 'none';
        }
    } catch (error) {
        console.error('Initialization error:', error);
        // 确保即使出错也移除loading状态
        const pageLoader = document.getElementById('pageLoader');
        if (pageLoader) {
            pageLoader.style.display = 'none';
        }
    }
}

// 确保在 DOM 完全加载后执行初始化
document.addEventListener('DOMContentLoaded', () => {
    initialize().catch(error => {
        console.error('Failed to initialize:', error);
        // 确保即使出错也移除loading状态
        const pageLoader = document.getElementById('pageLoader');
        if (pageLoader) {
            pageLoader.style.display = 'none';
        }
    });
});

// 定义处理图片的主函数
async function processImages() {
    try {
        // 先检查水印文本
        const text = watermarkText.value;
        if (!text.trim()) {
            watermarkText.classList.add('input-warning');
            ToastManager.showWarning('请输入水印文字', watermarkText);

            // 3秒后移除警告状态
            setTimeout(() => {
                watermarkText.classList.remove('input-warning');
            }, 3000);
            return;
        }

        // 保存所有水印设置
        console.log('正在保存水印设置');
        const watermarkSettings = {
            text: text,
            position: watermarkPosition.value,
            density: watermarkDensity.value,
            color: watermarkColor.value,
            size: watermarkSize.value,
            opacity: watermarkOpacity.value
        };
        localStorage.setItem('lastWatermarkSettings', JSON.stringify(watermarkSettings));
        console.log('水印设置已保存到 localStorage');
        previousWatermarkText.textContent = text;

        // 显示处理中的 loader
        processingLoader.style.display = 'block';
        processButton.disabled = true;

        // 处理图片
        if (uploadedFiles.length === 0) {
            const pasteArea = document.getElementById('pasteArea');
            pasteArea.classList.add('upload-warning');
            ToastManager.showWarning('请选择至少一张图片', pasteArea);

            // 3秒后移除警告状态
            setTimeout(() => {
                pasteArea.classList.remove('upload-warning');
            }, 3000);
            return;
        }

        // 保存现有的文件名
        const existingFilenames = {};
        document.querySelectorAll('.preview-item').forEach(item => {
            const img = item.querySelector('img');
            const input = item.querySelector('input[type="text"]');
            if (img && input) {
                existingFilenames[img.src] = input.value;
            }
        });

        // 清空预览容器
        previewContainer.innerHTML = '';

        // 处理每张图片
        for (const file of uploadedFiles) {
            await processImage(file, existingFilenames);
        }

        // 显示结果区域
        resultSection.classList.remove('hidden');

        // 滚动到结果区域
        resultSection.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('处理图片时出错:', error);
        ToastManager.showError('处理图片时出错，请重试');
    } finally {
        // 隐藏处理中的 loader
        processingLoader.style.display = 'none';
        processButton.disabled = false;
    }
}

// 添加事件监听
processButton.addEventListener('click', processImages);

// 初始化显示选项复选框
initializeDisplayOptions();

function processImage(file, existingFilenames = {}) {
    console.log('Processing image:', file.name);
    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            // 绘制原图
            ctx.drawImage(img, 0, 0);

            // 添加水印
            const text = watermarkText.value;
            const position = watermarkPosition.value;
            const density = position === 'tile' ? parseInt(watermarkDensity.value) : 1;
            const color = watermarkColor.value;
            const smallerDimension = Math.min(canvas.width, canvas.height);
            const size = Math.round((parseInt(watermarkSize.value) / 100) * smallerDimension);
            const opacity = parseInt(document.getElementById('watermarkOpacity').value) / 100;

            if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
                alert('请输入有效的颜色值，例如 #000000');
                return;
            }

            ctx.fillStyle = `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, ${opacity})`;
            ctx.font = `${size}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // 将文本分割成多行
            const lines = text.split('\n');
            const lineHeight = size * 1.2;

            if (position === 'tile') {
                // 整体平铺逻辑
                const angle = -Math.PI / 4;
                const cellWidth = canvas.width / density;
                const cellHeight = canvas.height / density;

                for (let i = 0; i < density; i++) {
                    for (let j = 0; j < density; j++) {
                        const x = (i + 0.5) * cellWidth;
                        const y = (j + 0.5) * cellHeight;

                        ctx.save();
                        ctx.translate(x, y);
                        ctx.rotate(angle);

                        if (lines.length === 1) {
                            ctx.fillText(text, 0, 0);
                        } else {
                            lines.forEach((line, index) => {
                                const yOffset = (index - (lines.length - 1) / 2) * lineHeight;
                                ctx.fillText(line, 0, yOffset);
                            });
                        }

                        ctx.restore();
                    }
                }
            } else if (position === 'center') {
                const x = canvas.width / 2;
                const y = canvas.height / 2;

                if (lines.length === 1) {
                    ctx.fillText(text, x, y);
                } else {
                    lines.forEach((line, index) => {
                        const yOffset = (index - (lines.length - 1) / 2) * lineHeight;
                        ctx.fillText(line, x, y + yOffset);
                    });
                }
            } else {
                const padding = 15;
                let x, y;

                switch (position) {
                    case 'bottomRight':
                        x = canvas.width - padding;
                        y = canvas.height - padding;
                        ctx.textAlign = 'right';
                        ctx.textBaseline = 'bottom';
                        break;
                    case 'bottomLeft':
                        x = padding;
                        y = canvas.height - padding;
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'bottom';
                        break;
                    case 'topRight':
                        x = canvas.width - padding;
                        y = padding;
                        ctx.textAlign = 'right';
                        ctx.textBaseline = 'top';
                        break;
                    case 'topLeft':
                        x = padding;
                        y = padding;
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'top';
                        break;
                }

                if (lines.length === 1) {
                    ctx.fillText(text, x, y);
                } else {
                    if (position.startsWith('bottom')) {
                        lines.reverse().forEach((line, index) => {
                            ctx.fillText(line, x, y - index * lineHeight);
                        });
                    } else {
                        lines.forEach((line, index) => {
                            ctx.fillText(line, x, y + index * lineHeight);
                        });
                    }
                }
            }

            // 创建预览项
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item bg-white p-4 rounded-lg shadow';

            const previewImg = document.createElement('img');
            previewImg.src = canvas.toDataURL();
            previewImg.className = 'preview-image w-full h-auto mb-4 cursor-pointer';
            previewImg.addEventListener('click', function () {
                modalImage.src = this.src;
                imageModal.classList.remove('hidden');
            });
            previewItem.appendChild(previewImg);

            // 生成唯一的ID前缀
            const uniqueId = `watermark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // 添加水印调整控件
            const watermarkControls = document.createElement('div');
            watermarkControls.className = 'watermark-controls mb-4 space-y-4';

            // 水平间距调整 (百分比)
            const hSpacingControl = createSliderControl(
                `${uniqueId}-horizontal-spacing`,
                '水平间距(%)',
                -50,
                50,
                0,
                (value) => updateWatermarkPosition(canvas, img, previewImg, uniqueId)
            );
            watermarkControls.appendChild(hSpacingControl);

            // 垂直间距调整 (百分比)
            const vSpacingControl = createSliderControl(
                `${uniqueId}-vertical-spacing`,
                '垂直间距(%)',
                -50,
                50,
                0,
                (value) => updateWatermarkPosition(canvas, img, previewImg, uniqueId)
            );
            watermarkControls.appendChild(vSpacingControl);

            // 水平位置调整 (百分比)
            const hPositionControl = createSliderControl(
                `${uniqueId}-horizontal-position`,
                '水平位置(%)',
                -50,
                50,
                0,
                (value) => updateWatermarkPosition(canvas, img, previewImg, uniqueId)
            );
            watermarkControls.appendChild(hPositionControl);

            // 垂直位置调整 (百分比)
            const vPositionControl = createSliderControl(
                `${uniqueId}-vertical-position`,
                '垂直位置(%)',
                -50,
                50,
                0,
                (value) => updateWatermarkPosition(canvas, img, previewImg, uniqueId)
            );
            watermarkControls.appendChild(vPositionControl);

            previewItem.appendChild(watermarkControls);

            // 生成自动文件名 (不显示输入框)
            const timestamp = getFormattedTimestamp();
            let autoFilename;
            if (file.name && file.name !== 'image.png') {
                const originalName = file.name.substring(0, file.name.lastIndexOf('.'));
                const extension = file.name.substring(file.name.lastIndexOf('.'));
                const watermarkIdentifier = '_已加水印_';
                autoFilename = `${originalName}${watermarkIdentifier}${timestamp}${extension}`;
            } else {
                autoFilename = `image_${timestamp}.png`;
            }

            // 存储文件名到预览项的数据属性
            previewItem.setAttribute('data-filename', autoFilename);

            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'flex space-x-2 button-group';

            const downloadLink = document.createElement('a');
            downloadLink.href = canvas.toDataURL(file.type || 'image/png');
            downloadLink.className = 'download-button';
            downloadLink.textContent = '下载图片';
            downloadLink.addEventListener('click', function (e) {
                let filename = autoFilename;
                if (!filename.match(/\.[^.]+$/)) {
                    filename += '.png';
                }
                this.download = filename;
            });
            buttonGroup.appendChild(downloadLink);

            const copyButton = document.createElement('button');
            copyButton.textContent = '复制到剪贴板';
            copyButton.className = 'copy-button';
            copyButton.addEventListener('click', () => copyImageToClipboard(canvas));
            buttonGroup.appendChild(copyButton);

            previewItem.appendChild(buttonGroup);
            previewContainer.appendChild(previewItem);

            // 应用显示设置到新创建的预览项
            applyDisplaySettings();
        }
        img.src = e.target.result;
    }
    reader.readAsDataURL(file);
}

// 创建滑块控件
function createSliderControl(id, label, min, max, defaultValue, onChange) {
    const container = document.createElement('div');
    container.className = 'slider-control';

    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'flex items-center space-x-3';

    const labelElement = document.createElement('label');
    labelElement.className = 'text-gray-700 text-xs font-medium w-16 flex-shrink-0';
    labelElement.textContent = label;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = id;
    slider.min = min;
    slider.max = max;
    slider.value = defaultValue;
    slider.className = 'flex-1 slider-improved';

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'text-sm text-gray-600 w-12 text-right';
    valueDisplay.textContent = defaultValue;

    // 简化版本 - 直接响应
    slider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        valueDisplay.textContent = value;

        try {
            onChange(value);
        } catch (error) {
            console.error('Slider onChange error:', error);
        }
    });

    sliderContainer.appendChild(labelElement);
    sliderContainer.appendChild(slider);
    sliderContainer.appendChild(valueDisplay);
    container.appendChild(sliderContainer);

    return container;
}

// 更新水印位置
function updateWatermarkPosition(canvas, originalImg, previewImg, uniqueId) {
    try {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(originalImg, 0, 0);

        const text = watermarkText.value;
        const position = watermarkPosition.value;
        const density = position === 'tile' ? parseInt(watermarkDensity.value) : 1;
        const color = watermarkColor.value;
        const smallerDimension = Math.min(canvas.width, canvas.height);
        const size = Math.round((parseInt(watermarkSize.value) / 100) * smallerDimension);
        const opacity = parseInt(document.getElementById('watermarkOpacity').value) / 100;

        ctx.fillStyle = `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, ${opacity})`;
        ctx.font = `${size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const lines = text.split('\n');
        const lineHeight = size * 1.2;

        // 获取当前图片的所有滑块值 (百分比) 并转换为像素
        const hSpacingPercent = parseInt(document.getElementById(`${uniqueId}-horizontal-spacing`).value);
        const vSpacingPercent = parseInt(document.getElementById(`${uniqueId}-vertical-spacing`).value);
        const hPositionPercent = parseInt(document.getElementById(`${uniqueId}-horizontal-position`).value);
        const vPositionPercent = parseInt(document.getElementById(`${uniqueId}-vertical-position`).value);

        // 转换百分比为像素值
        const hSpacing = (hSpacingPercent / 100) * canvas.width;
        const vSpacing = (vSpacingPercent / 100) * canvas.height;
        const hPosition = (hPositionPercent / 100) * canvas.width;
        const vPosition = (vPositionPercent / 100) * canvas.height;

        if (position === 'tile') {
            const angle = -Math.PI / 4;
            const cellWidth = canvas.width / density;
            const cellHeight = canvas.height / density;

            for (let i = 0; i < density; i++) {
                for (let j = 0; j < density; j++) {
                    const x = (i + 0.5) * cellWidth + hPosition + (i * hSpacing);
                    const y = (j + 0.5) * cellHeight + vPosition + (j * vSpacing);

                    ctx.save();
                    ctx.translate(x, y);
                    ctx.rotate(angle);

                    if (lines.length === 1) {
                        ctx.fillText(text, 0, 0);
                    } else {
                        lines.forEach((line, index) => {
                            const yOffset = (index - (lines.length - 1) / 2) * lineHeight;
                            ctx.fillText(line, 0, yOffset);
                        });
                    }

                    ctx.restore();
                }
            }
        } else {
            const padding = 15;
            let x, y;

            switch (position) {
                case 'bottomRight':
                    x = canvas.width - padding + hPosition;
                    y = canvas.height - padding + vPosition;
                    ctx.textAlign = 'right';
                    ctx.textBaseline = 'bottom';
                    break;
                case 'bottomLeft':
                    x = padding + hPosition;
                    y = canvas.height - padding + vPosition;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'bottom';
                    break;
                case 'topRight':
                    x = canvas.width - padding + hPosition;
                    y = padding + vPosition;
                    ctx.textAlign = 'right';
                    ctx.textBaseline = 'top';
                    break;
                case 'topLeft':
                    x = padding + hPosition;
                    y = padding + vPosition;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    break;
                case 'center':
                    x = canvas.width / 2 + hPosition;
                    y = canvas.height / 2 + vPosition;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    break;
            }

            if (lines.length === 1) {
                ctx.fillText(text, x, y);
            } else {
                if (position.startsWith('bottom')) {
                    lines.reverse().forEach((line, index) => {
                        ctx.fillText(line, x, y - index * (lineHeight + vSpacing));
                    });
                } else {
                    lines.forEach((line, index) => {
                        ctx.fillText(line, x, y + index * (lineHeight + vSpacing));
                    });
                }
            }
        }

        previewImg.src = canvas.toDataURL();
    } catch (error) {
        console.error('Error updating watermark position:', error);
    }
}

// 添加这个函数
function updateColorPreview() {
    const color = watermarkColor.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
        colorPreview.style.backgroundColor = color;
        colorPicker.value = color;
        watermarkColor.style.borderColor = '#e2e8f0'; // 重置边框颜色
    } else {
        colorPreview.style.backgroundColor = '#ffffff';
        watermarkColor.style.borderColor = '#f56565'; // 设置红色边框表示无效输入
    }
}

// 在文件底部添加这些事件监听器
watermarkColor.addEventListener('input', updateColorPreview);
colorPreview.addEventListener('click', () => colorPicker.click());
colorPicker.addEventListener('input', () => {
    watermarkColor.value = colorPicker.value;
    updateColorPreview();
});

// 确保这段代码在文件末尾
imageModal.addEventListener('click', function () {
    console.log('Modal clicked'); // 添加调试日志
    this.classList.add('hidden');
});

// 添加这行代码来检查元素是否正确获取
console.log('imageModal element:', imageModal);
console.log('modalImage element:', modalImage);

function initializeFileInput() {
    const fileInput = document.getElementById('imageInput');
    const pasteArea = document.getElementById('pasteArea');

    // 添加清除所有图片按钮
    const clearButton = document.createElement('button');
    clearButton.className = 'ml-2 text-sm text-red-500 hover:text-red-700';
    clearButton.textContent = '清除所有';
    clearButton.addEventListener('click', () => {
        uploadedFiles = [];
        updateFileInput();
        updateFileNameDisplay();
        updateImagePreview();
    });

    const fileStatusContainer = document.querySelector('.file-status-container');
    fileStatusContainer.appendChild(clearButton);

    fileInput.addEventListener('change', handleFileSelect);
}

// 修改 handleFileSelect 函数
function handleFileSelect(e) {
    const files = e.target.files;
    uploadedFiles = uploadedFiles.concat(Array.from(files)); // 使用 concat 来添加新文件
    updateFileNameDisplay();
    updateImagePreview();
}

// 修改 handlePaste 函数
function handlePaste(e) {
    e.preventDefault();
    e.stopPropagation();

    const items = e.clipboardData.items;
    const newFiles = [];

    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            newFiles.push(blob);
        }
    }

    uploadedFiles = uploadedFiles.concat(newFiles); // 使用 concat 来添加新文件
    updateFileNameDisplay();
    updateImagePreview();
}

// 修改 updateFileNameDisplay 函数
function updateFileNameDisplay() {
    const fileNameDisplay = document.querySelector('.file-status-container span');

    if (uploadedFiles.length > 0) {
        const fileCount = uploadedFiles.length;
        const filesSelectedText = '张图片已选择';
        fileNameDisplay.textContent = `${fileCount} ${filesSelectedText}`;
    } else {
        fileNameDisplay.textContent = '未选择图片';
    }
}

// 修改 updateImagePreview 函数
function updateImagePreview() {
    imagePreviewArea.innerHTML = ''; // 清空现有预览
    imagePreviewArea.classList.remove('hidden');

    // 显示所有已上传图片的缩略预览（不再限制为30）
    uploadedFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const previewWrapper = document.createElement('div');
            previewWrapper.className = 'relative group';

            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'w-16 h-16 object-cover rounded';
            img.loading = 'lazy'; // 添加延迟加载
            img.width = 64;  // 添加明确的尺寸
            img.height = 64;
            previewWrapper.appendChild(img);

            // 添加删除按钮
            const deleteButton = document.createElement('button');
            deleteButton.className = 'absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity';
            deleteButton.innerHTML = '×';
            deleteButton.onclick = (e) => {
                e.stopPropagation();
                // 使用最新的 uploadedFiles 索引查找并移除对应文件（避免闭包索引失效）
                const idx = Array.from(imagePreviewArea.querySelectorAll('.relative.group')).indexOf(previewWrapper);
                if (idx !== -1) {
                    uploadedFiles.splice(idx, 1);
                }
                updateFileInput();
                updateFileNameDisplay();
                updateImagePreview();
            };
            previewWrapper.appendChild(deleteButton);

            imagePreviewArea.appendChild(previewWrapper);
        }
        reader.readAsDataURL(file);
    });

    // 不再显示关于 "前30张" 的提示，预览区域会展示所有已上传图片
}

// 添加重置函数
function resetAll() {
    uploadedFiles = [];
    lastUploadDirectory = null;
    updateFileInput();
    updateFileNameDisplay();
    updateImagePreview();
    document.getElementById('watermarkText').value = '';
    document.getElementById('watermarkPosition').value = 'tile'; // 重置水印位置
    document.getElementById('watermarkDensity').value = '2';
    document.getElementById('watermarkDensity').disabled = false;
    document.getElementById('watermarkColor').value = '#ffffff';
    document.getElementById('watermarkSize').value = '5'; // Default to 5% of image size
    updateColorPreview();
    previewContainer.innerHTML = '';
    // 重置时隐藏结果部分
    resultSection.classList.add('hidden');
    document.getElementById('watermarkPosition').value = 'tile';
    document.getElementById('watermarkDensity').disabled = false;
    updateWatermarkDensityOptions(false);
    toggleWatermarkDensity();
    document.getElementById('watermarkOpacity').value = '50';
}

function updateFileInput() {
    const dt = new DataTransfer();
    uploadedFiles.forEach(file => dt.items.add(file));
    document.getElementById('imageInput').files = dt.files;
}

async function downloadAllImages() {
    console.log('Download all images triggered');

    if (previewContainer.children.length === 0) {
        alert('没有可下载的图片');
        return;
    }

    // Create zip file
    const zip = new JSZip();
    const watermarkTextValue = watermarkText.value || 'watermark';
    const timestamp = getFormattedTimestamp();
    const zipFilename = `${watermarkTextValue}-${timestamp}.zip`;

    // 收集所有预览项
    const previewItems = Array.from(previewContainer.querySelectorAll('.preview-item'));

    try {
        // 等待所有图片添加完成
        await Promise.all(previewItems.map(async (previewItem) => {
            const img = previewItem.querySelector('img');

            // 从数据属性获取文件名
            let filename = previewItem.getAttribute('data-filename') || 'image.png';

            try {
                const response = await fetch(img.src);
                const blob = await response.blob();
                // 确保blob的type是正确的
                const imageBlob = new Blob([blob], { type: 'image/png' });
                zip.file(filename, imageBlob, { binary: true });
            } catch (error) {
                console.error('处理图片出错:', error);
                throw error;
            }
        }));

        // 生成并下载 zip 文件
        const content = await zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: {
                level: 9
            }
        });
        FileSaver.saveAs(content, zipFilename);
    } catch (error) {
        console.error('下载出错:', error);
        alert('下载出错，请重试');
    }
}

// 添加个辅助函数来生成时间戳
function getFormattedTimestamp() {
    const now = new Date();
    return now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0');
}

function handleMobileInteraction() {
    const isMobile = window.innerWidth <= 640;
    const processButton = document.getElementById('processButton');
    const resetButton = document.getElementById('resetButton');

    if (isMobile) {
        processButton.textContent = '处理';
        resetButton.textContent = '重置';
    } else {
        processButton.textContent = '处理图片';
        resetButton.textContent = '重置';
    }
}

function toggleWatermarkDensity() {
    const watermarkPosition = document.getElementById('watermarkPosition');
    const watermarkDensity = document.getElementById('watermarkDensity');

    if (watermarkPosition.value === 'tile') {
        watermarkDensity.disabled = false;
        watermarkDensity.value = watermarkDensity.getAttribute('data-previous-value') || '3';
        updateWatermarkDensityOptions(false);
    } else {
        watermarkDensity.setAttribute('data-previous-value', watermarkDensity.value);
        watermarkDensity.value = '1';
        watermarkDensity.disabled = true;
        updateWatermarkDensityOptions(true);
    }
}

function updateWatermarkDensityOptions(singleWatermark) {
    const watermarkDensity = document.getElementById('watermarkDensity');
    if (singleWatermark) {
        watermarkDensity.innerHTML = `<option value="1">1个水印</option>`;
    } else {
        watermarkDensity.innerHTML = `
            <option value="2" selected>2x2 (4个水印)</option>
            <option value="3">3x3 (9个水印)</option>
            <option value="4">4x4 (16个水印)</option>
            <option value="5">5x5 (25个水印)</option>
            <option value="6">6x6 (36个水印)</option>
        `;
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // 触发重绘
    toast.offsetHeight;

    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 2000);
}

async function copyImageToClipboard(canvas) {
    try {
        const blob = await new Promise(resolve => canvas.toBlob(resolve));
        await navigator.clipboard.write([
            new ClipboardItem({
                'image/png': blob
            })
        ]);
        showToast('图片已复制到剪贴板');
    } catch (err) {
        console.error('Failed to copy image: ', err);
        showToast('复制失败，请重试');
    }
}

// 修改透明度输入验证
const watermarkOpacity = document.getElementById('watermarkOpacity');

// 在输入时只做基本的字符验证
watermarkOpacity.addEventListener('input', function (e) {
    // 移除非数字字符
    this.value = this.value.replace(/[^\d]/g, '');
});

// 在失去焦点时进行值的范围验证
watermarkOpacity.addEventListener('blur', function (e) {
    let value = parseInt(this.value);

    if (isNaN(value) || value === '') {
        value = 80; // 默认值
    } else if (value < 0) {
        value = 0;
    } else if (value > 100) {
        value = 100;
    }

    this.value = value;
});

// 添加以下拖拽处理函数
function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    this.classList.add('drag-over');
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    this.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    this.classList.remove('drag-over');
}

async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    this.classList.remove('drag-over');

    console.log('Drop event triggered');
    console.log('DataTransfer items:', e.dataTransfer.items);

    const items = Array.from(e.dataTransfer.items);
    const newFiles = [];

    for (const item of items) {
        console.log('Processing item:', item);
        console.log('Item kind:', item.kind);

        if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry();
            console.log('File entry:', entry);

            if (entry) {
                if (entry.isDirectory) {
                    console.log('Directory entry found:', entry);
                    console.log('Directory name:', entry.name);
                    console.log('Directory fullPath:', entry.fullPath);

                    // Store directory entry for later use
                    lastUploadDirectory = entry;
                    console.log('Stored directory entry:', lastUploadDirectory);

                    // Process directory
                    const files = await getAllFilesFromDirectory(entry);
                    console.log('Files from directory:', files);
                    newFiles.push(...files);
                } else if (entry.isFile && isImageFile(entry.name)) {
                    const file = item.getAsFile();
                    console.log('Image file found:', file);
                    newFiles.push(file);
                }
            }
        }
    }

    if (newFiles.length === 0) {
        ToastManager.showWarning('请拖入图片文件或文件夹', this);
        return;
    }

    // 不再限制总上传数量：将所有找到的图片加入 uploadedFiles
    uploadedFiles = uploadedFiles.concat(newFiles);

    updateFileNameDisplay();
    updateImagePreview();
}

// Helper function to check if a file is an image
function isImageFile(filename) {
    return /\.(jpe?g|png)$/i.test(filename);
}

// Helper function to get all files from a directory
function getAllFilesFromDirectory(dirEntry) {
    return new Promise((resolve, reject) => {
        const files = [];
        const reader = dirEntry.createReader();

        function readEntries() {
            reader.readEntries(async (entries) => {
                if (entries.length === 0) {
                    resolve(files);
                    return;
                }

                for (const entry of entries) {
                    if (entry.isFile && isImageFile(entry.name)) {
                        try {
                            const file = await getFileFromEntry(entry);
                            files.push(file);
                        } catch (error) {
                            console.error('Error getting file:', error);
                        }
                    }
                }

                readEntries(); // Continue reading if there are more entries
            }, reject);
        }

        readEntries();
    });
}

// Helper function to get file from FileEntry
function getFileFromEntry(entry) {
    return new Promise((resolve, reject) => {
        entry.file(resolve, reject);
    });
}

// 初始化显示选项
function initializeDisplayOptions() {
    const hideSliders = document.getElementById('hideSliders');
    const hideButtons = document.getElementById('hideButtons');

    // 从localStorage加载设置
    const savedHideSliders = localStorage.getItem('hideSliders') === 'true';
    const savedHideButtons = localStorage.getItem('hideButtons') === 'true';

    // 设置默认值（隐藏）
    hideSliders.checked = savedHideSliders !== null ? savedHideSliders : true;
    hideButtons.checked = savedHideButtons !== null ? savedHideButtons : true;

    // 应用初始设置
    applyDisplaySettings();

    // 添加事件监听器
    hideSliders.addEventListener('change', () => {
        localStorage.setItem('hideSliders', hideSliders.checked);
        applyDisplaySettings();
    });

    hideButtons.addEventListener('change', () => {
        localStorage.setItem('hideButtons', hideButtons.checked);
        applyDisplaySettings();
    });
}

// 应用显示设置
function applyDisplaySettings() {
    const hideSliders = document.getElementById('hideSliders').checked;
    const hideButtons = document.getElementById('hideButtons').checked;

    // 控制所有现有预览项的显示
    document.querySelectorAll('.preview-item').forEach(item => {
        // 控制滑块显示
        const sliderControls = item.querySelectorAll('.slider-control');
        sliderControls.forEach(control => {
            control.style.display = hideSliders ? 'none' : 'block';
        });

        // 控制按钮显示
        const buttonGroup = item.querySelector('.flex.space-x-2');
        if (buttonGroup) {
            buttonGroup.style.display = hideButtons ? 'none' : 'flex';
        }
    });
}