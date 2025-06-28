import { translations, setLanguage, updateURL, currentLang } from './i18n.js';
import JSZip from 'https://jspm.dev/jszip';
import FileSaver from 'https://jspm.dev/file-saver';
import VideoProcessor from './videoProcessor.js';

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
const languageSelector = document.getElementById('languageSelector');
const processingLoader = document.getElementById('processingLoader');
const imagePreviewArea = document.getElementById('imagePreviewArea');
const resetButton = document.getElementById('resetButton');
let uploadedFiles = []; // 用于存储已上传的文件
const downloadAllButton = document.getElementById('downloadAllButton');
const resultSection = document.getElementById('resultSection');
const watermarkPosition = document.getElementById('watermarkPosition');

// Add video quality and format elements
const videoQuality = document.getElementById('videoQuality');
const videoFormat = document.getElementById('videoFormat');

// Declare processedFiles in a higher scope so downloadAllImages can access it
let processedFiles = [];
// Add mapping between original and processed files
let fileMapping = new Map(); // Maps processed file to original file

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
        imageModal.addEventListener('click', function() {
            console.log('Modal clicked');
            this.classList.add('hidden');
        });

        languageSelector.addEventListener('change', (e) => {
            const lang = e.target.value;
            setLanguage(lang);
            updateURL(lang);
        });

        const urlParams = new URLSearchParams(window.location.search);
        const lang = urlParams.get('lang') || (window.location.pathname.includes('/en') ? 'en' : 'zh-CN');
        setLanguage(lang);
        languageSelector.value = lang;

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
                previousWatermarkText.title = `${translations[currentLang].text}: ${settings.text}
${translations[currentLang].position}: ${settings.position}
${translations[currentLang].density}: ${settings.density}
${translations[currentLang].color}: ${settings.color}
${translations[currentLang].size}: ${settings.size}%
${translations[currentLang].opacity}: ${settings.opacity}%`;
                
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

        // 在文件开头添加样式
        const style = document.createElement('style');
        style.textContent = `
            #previewContainer {
                position: relative;
                left: 0;
                right: 0;
                width: 100vw !important;
                max-width: 100vw !important;
                margin: 0 !important;
                padding: 0 !important;
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 2rem;
                box-sizing: border-box;
                background: none;
            }
            .preview-item {
                display: flex;
                flex-direction: column;
                min-width: 0;
            }
            .watermark-controls {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            .slider-control {
                grid-column: span 1;
            }
            .slider-control label {
                font-size: 0.875rem;
                margin-bottom: 0.25rem;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .slider-control input[type="range"] {
                width: 100%;
            }
            @media (min-width: 1800px) {
                #previewContainer {
                    grid-template-columns: repeat(5, 1fr);
                }
            }
            @media (min-width: 1400px) and (max-width: 1799px) {
                #previewContainer {
                    grid-template-columns: repeat(4, 1fr);
                }
            }
            @media (max-width: 1280px) {
                #previewContainer {
                    grid-template-columns: repeat(3, 1fr);
                }
            }
            @media (max-width: 1024px) {
                #previewContainer {
                    grid-template-columns: repeat(2, 1fr);
                }
            }
            @media (max-width: 640px) {
                #previewContainer {
                    grid-template-columns: 1fr;
                }
            }
        `;
        document.head.appendChild(style);
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
async function processFiles() {
    if (uploadedFiles.length === 0) {
        ToastManager.showWarning(translations[currentLang].noFilesSelected);
        return;
    }

    processButton.disabled = true;
    processingLoader.style.display = 'flex';
    resetButton.disabled = true;
    resultSection.classList.remove('hidden');
    previewContainer.innerHTML = '';

    // Progress bar elements
    const batchProgressContainer = document.getElementById('batchProgressContainer');
    const batchProgressBar = document.getElementById('batchProgressBar');
    const batchProgressText = document.getElementById('batchProgressText');
    const videoProgressContainer = document.getElementById('videoProgressContainer');
    const videoProgressBar = document.getElementById('videoProgressBar');
    const videoProgressText = document.getElementById('videoProgressText');
    batchProgressContainer.style.display = 'block';
    videoProgressContainer.style.display = 'none';
    batchProgressBar.style.width = '0%';
    batchProgressText.textContent = '';
    videoProgressBar.style.width = '0%';
    videoProgressText.textContent = '';

    const zip = new JSZip();
    const existingFilenames = {};
    let filesToProcess = [...uploadedFiles]; // Create a copy initially

    try {
        filesToProcess = filesToProcess.filter(file => file instanceof File && file.name && typeof file.size === 'number');
        if (filesToProcess.length === 0) {
             ToastManager.showWarning(translations[currentLang].noValidFilesToProcess || 'No valid files selected for processing.');
             processButton.disabled = false;
             processingLoader.style.display = 'none';
             resetButton.disabled = false;
             resultSection.classList.add('hidden'); // Hide results if no files processed
             return;
        }

        for (let i = 0; i < filesToProcess.length; i++) {
            const file = filesToProcess[i];

            // *** Add a very early and explicit null/undefined check ***
            if (file === undefined || file === null) {
                console.warn('Skipping undefined or null entry in file list at index', i);
                continue; // Skip this iteration if the entry is undefined or null
            }

            // Explicitly check if file is a File object before proceeding
            if (!(file instanceof File)) {
                console.warn('Skipping invalid entry in file list:', file);
                continue; // Skip if the entry is not a valid File object
            }

            // Add an extra safeguard: ensure file object has a name property
            if (!file.name) {
                console.warn('Skipping file with no name property:', file);
                continue;
            }

            // *** Double-check file validity immediately before accessing name ***
            if (!file || typeof file.name !== 'string') {
                console.error('Unexpected invalid file object encountered:', file);
                continue; // Skip this iteration if file or file.name is invalid
            }

            // Update batch progress
            batchProgressText.textContent = `Processing file ${i + 1} of ${filesToProcess.length}`;
            batchProgressBar.style.width = `${Math.floor(((i) / filesToProcess.length) * 100)}%`;

            let processedFile = null; // Initialize to null

            try {
                if (isVideoFile(file.name)) {
                    // Show per-video progress
                    videoProgressContainer.style.display = 'block';
                    videoProgressBar.style.width = '0%';
                    videoProgressText.textContent = 'Processing video: 0%';
                    processedFile = await processVideo(file, existingFilenames, (percent) => {
                        videoProgressBar.style.width = percent + '%';
                        videoProgressText.textContent = `Processing video: ${percent}%`;
                    });
                    videoProgressBar.style.width = '100%';
                    videoProgressText.textContent = 'Processing video: 100%';
                    videoProgressContainer.style.display = 'none';
                } else {
                    videoProgressContainer.style.display = 'none';
                    // Await the refactored processImage which now returns a File object
                    processedFile = await processImage(file, existingFilenames);
                }
            } catch (processingError) {
                console.error(`Error processing file ${file.name}:`, processingError);
                ToastManager.showError(`Failed to process ${file.name}: ${processingError.message}`);
                // processedFile remains null, and we will skip adding it below
            }

            // *** Add the processed file to the list and zip ONLY IF it was successfully processed ***
            if (processedFile instanceof File) { // Explicitly check if it's a File object
                // *** Log the file object right before adding to zip ***
                console.log('Adding file to zip:', processedFile);
                // *** Add an extra check for the name property ***
                if (typeof processedFile.name !== 'string' || !processedFile.name) {
                    console.error('Processed file has invalid name property, skipping zip.file:', processedFile);
                    continue; // Skip adding to zip if name is invalid
                }
                processedFiles.push(processedFile);
                // Store mapping between processed file and original file
                fileMapping.set(processedFile, file);
                // Use the name from the processedFile object
                zip.file(processedFile.name, processedFile);
            } else {
                 console.warn('Processing of file resulted in no valid output:', file.name || 'Unknown file');
            }

            batchProgressBar.style.width = `${Math.floor(((i + 1) / filesToProcess.length) * 100)}%`;
        }

        // Final batch progress update - use filesToProcess length
        batchProgressText.textContent = `Processed ${filesToProcess.length} files` || 'All files processed';
        batchProgressBar.style.width = '100%';
        // Keep progress bars visible briefly after completion
        setTimeout(() => {
             batchProgressContainer.style.display = 'none';
             videoProgressContainer.style.display = 'none'; // Hide video bar too
        }, 1500);

        // *** Create previews for ALL processed files (images and videos) ***
        previewContainer.innerHTML = ''; // Clear existing previews
        resultSection.classList.remove('hidden'); // Ensure results section is visible

        for (const file of processedFiles) {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item bg-white p-4 rounded-lg shadow w-full';

            if (isVideoFile(file.name)) {
                 const video = document.createElement('video');
                 video.src = URL.createObjectURL(file);
                 video.controls = true;
                 video.className = 'preview-video w-full h-auto mb-4';
                 previewItem.appendChild(video);
             } else {
                const previewImg = document.createElement('img');
                previewImg.src = URL.createObjectURL(file);
                previewImg.className = 'preview-image w-full h-auto mb-4 cursor-pointer';
                previewImg.addEventListener('click', function() {
                    modalImage.src = this.src;
                    imageModal.classList.remove('hidden');
                });
                previewItem.appendChild(previewImg);

                // Add position adjustment sliders for single watermarks (center position)
                if (watermarkPosition.value === 'center') {
                    const controlsContainer = document.createElement('div');
                    controlsContainer.className = 'watermark-controls mb-4';
                    
                    // Create unique ID for this preview item
                    const uniqueId = `preview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    
                    // Get the original file from the mapping
                    const originalFile = fileMapping.get(file) || file;
                    
                    // Horizontal position slider
                    const horizontalSlider = createSliderControl(
                        `${uniqueId}-horizontal-position`,
                        translations[currentLang].horizontalPosition || 'Horizontal Position',
                        -200,
                        200,
                        0,
                        (value) => updateWatermarkPositionForPreview(previewItem, file, uniqueId, value, 'horizontal')
                    );
                    
                    // Vertical position slider
                    const verticalSlider = createSliderControl(
                        `${uniqueId}-vertical-position`,
                        translations[currentLang].verticalPosition || 'Vertical Position',
                        -200,
                        200,
                        0,
                        (value) => updateWatermarkPositionForPreview(previewItem, file, uniqueId, value, 'vertical')
                    );
                    
                    controlsContainer.appendChild(horizontalSlider);
                    controlsContainer.appendChild(verticalSlider);
                    previewItem.appendChild(controlsContainer);
                    
                    // Store the original file reference for reprocessing
                    previewItem.originalFile = originalFile;
                }
            }

            // Add filename input (using the generated name)
            const filenameContainer = document.createElement('div');
            filenameContainer.className = 'mb-4';

            const filenameLabel = document.createElement('label');
            filenameLabel.className = 'block text-gray-700 text-sm font-bold mb-2';
            filenameLabel.textContent = translations[currentLang].filename || 'Filename';
            filenameContainer.appendChild(filenameLabel);

            const filenameInput = document.createElement('input');
            filenameInput.type = 'text';
            filenameInput.className = 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline';
            filenameInput.spellcheck = false;
            filenameInput.autocomplete = 'off';
            filenameInput.value = file.name; // Use the processed file's name
            // Add event listener to update the file name in the processedFiles array if the user changes it
            filenameInput.addEventListener('input', (e) => {
                 // Find the corresponding file in processedFiles and update its name
                 const fileIndex = processedFiles.findIndex(f => f === file); // Find by reference
                 if (fileIndex > -1) {
                     // Create a new File object with the updated name (File objects are immutable)
                     processedFiles[fileIndex] = new File([file], e.target.value, { type: file.type });
                 }
            });

            filenameContainer.appendChild(filenameInput);
            previewItem.appendChild(filenameContainer);

            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'button-group';

            // Individual download button (using the processed File object)
            const downloadLink = document.createElement('a');
            downloadLink.href = URL.createObjectURL(file);
            downloadLink.className = 'download-button';
            downloadLink.textContent = translations[currentLang].download || 'Download';
            downloadLink.download = file.name; // Use the processed file's name for download
            // Clean up the object URL after download (optional, good practice for many files)
            downloadLink.addEventListener('click', () => {
                // Delay revokeObjectURL slightly to ensure download starts
                setTimeout(() => URL.revokeObjectURL(downloadLink.href), 100);
            });
            buttonGroup.appendChild(downloadLink);

             // Add Copy to Clipboard button for images (not supported for videos directly as an image)
             if (!isVideoFile(file.name)) {
                 const copyButton = document.createElement('button');
                 copyButton.textContent = translations[currentLang].copyToClipboard || 'Copy';
                 copyButton.className = 'copy-button';
                 // Need a way to get the canvas from the processed image file for copying
                 // This might require re-drawing the image onto a temporary canvas for copying
                 copyButton.addEventListener('click', async () => {
                     try {
                         const imgElement = previewItem.querySelector('.preview-image');
                         if (imgElement) {
                             const tempCanvas = document.createElement('canvas');
                             tempCanvas.width = imgElement.naturalWidth;
                             tempCanvas.height = imgElement.naturalHeight;
                             const tempCtx = tempCanvas.getContext('2d');
                             tempCtx.drawImage(imgElement, 0, 0);
                             await copyImageToClipboard(tempCanvas); // Reuse the existing copy function
                         }
                     } catch (error) {
                         console.error('Failed to copy image from preview:', error);
                         ToastManager.showError(translations[currentLang].copyFailed || 'Failed to copy image.');
                     }
                 });
                 buttonGroup.appendChild(copyButton);
             }

            previewItem.appendChild(buttonGroup);
            previewContainer.appendChild(previewItem);
        }

        // Scroll to results section
        resultSection.scrollIntoView({ behavior: 'smooth' });

        // Save settings after successful processing
        saveSettings();

    } catch (error) {
        console.error('Processing error:', error);
        ToastManager.showError(translations[currentLang].processingError || 'An error occurred during processing.');
    } finally {
        processButton.disabled = false;
        processingLoader.style.display = 'none';
        resetButton.disabled = false;
        // Ensure progress bars are hidden
        batchProgressContainer.style.display = 'none';
        videoProgressContainer.style.display = 'none';
    }
}

async function processVideo(file, existingFilenames = {}, onProgress) {
    const videoProcessor = new VideoProcessor();
    const options = {
        watermarkText: watermarkText.value,
        position: watermarkPosition.value,
        color: watermarkColor.value,
        size: parseInt(watermarkSize.value),
        opacity: parseInt(watermarkOpacity.value),
        quality: videoQuality.value,
        format: videoFormat.value,
        onProgress,
        density: parseInt(watermarkDensity.value)
    };

    const processedBlob = await videoProcessor.processVideo(file, options);
    const newFilename = generateUniqueFilename(file.name, existingFilenames);
    return new File([processedBlob], newFilename, { type: processedBlob.type });
}

function isVideoFile(filename) {
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
    return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

function generateUniqueFilename(originalName, existingFilenames) {
    // Ensure originalName is a string before splitting
    if (typeof originalName !== 'string') {
        console.warn('generateUniqueFilename received non-string name:', originalName);
        originalName = 'unknown_file';
    }
    const timestamp = getFormattedTimestamp();
    // Add a check to handle cases where originalName might not have an extension
    const parts = originalName.split('.');
    const extension = parts.length > 1 ? parts.pop() : '';
    const baseName = parts.join('.');
    let newName = `${baseName}_watermarked_${timestamp}${extension ? '.' + extension : ''}`;

    let counter = 1;
    while (existingFilenames[newName]) {
        newName = `${baseName}_watermarked_${timestamp}_${counter}${extension ? '.' + extension : ''}`;
        counter++;
    }

    existingFilenames[newName] = true;
    return newName;
}

// 添加事件监听
processButton.addEventListener('click', processFiles);

// Modify processImage to return a Promise that resolves with the processed File object
function processImage(file, existingFilenames = {}, positionAdjustments = { horizontal: 0, vertical: 0 }) {
    console.log('Processing image:', file.name);
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');

                // Draw original image
                ctx.drawImage(img, 0, 0);

                // Add watermark (using existing logic)
                const text = watermarkText.value;
                const position = watermarkPosition.value;
                const density = position === 'tile' ? parseInt(watermarkDensity.value) : 1;
                const color = watermarkColor.value;
                const smallerDimension = Math.min(canvas.width, canvas.height);
                const size = Math.round((parseInt(watermarkSize.value) / 100) * smallerDimension);
                const opacity = parseInt(document.getElementById('watermarkOpacity').value) / 100;

                if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
                     // Reject the promise if color is invalid
                    reject(new Error(translations[currentLang].invalidColorValue || 'Invalid color value.'));
                    return; // Stop processing
                }

                ctx.fillStyle = `rgba(${parseInt(color.slice(1,3),16)}, ${parseInt(color.slice(3,5),16)}, ${parseInt(color.slice(5,7),16)}, ${opacity})`;
                ctx.font = `${size}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                const lines = text.split('\n');
                const lineHeight = size * 1.2;

                // Simplified tiling logic (without per-image adjustments here)
                if (position === 'tile') {
                    const angle = -Math.PI / 4;
                    let maxTextWidth = 0;
                    lines.forEach(line => {
                        const w = ctx.measureText(line).width;
                        if (w > maxTextWidth) maxTextWidth = w;
                    });
                    const textBlockHeight = lineHeight * lines.length;
                    const cellWidth = Math.max(canvas.width / density, maxTextWidth + 20);
                    const cellHeight = Math.max(canvas.height / density, textBlockHeight + 20);

                    for (let i = 0; i < density; i++) {
                        for (let j = 0; j < density; j++) {
                            const x = (i + 0.5) * cellWidth;
                            const y = (j + 0.5) * cellHeight;

                            ctx.save();
                            ctx.translate(x, y);
                            ctx.rotate(angle);
                            lines.forEach((line, index) => {
                                const yOffset = (index - (lines.length - 1) / 2) * lineHeight;
                                ctx.fillText(line, 0, yOffset);
                            });
                            ctx.restore();
                        }
                    }
                } else {
                    // Apply position adjustments for single watermarks
                    let x, y;
                    ctx.textAlign = 'center'; // Default to center alignment for single watermark
                    ctx.textBaseline = 'middle'; // Default to middle baseline for single watermark
                    const padding = 15;
                    
                    // Calculate adjustment scale based on image size
                    const maxDimension = Math.max(canvas.width, canvas.height);
                    const adjustmentScale = maxDimension / 400; // Scale adjustments based on image size
                    const horizontalAdjustment = (positionAdjustments.horizontal || 0) * adjustmentScale;
                    const verticalAdjustment = (positionAdjustments.vertical || 0) * adjustmentScale;

                    switch (position) {
                        case 'center':
                            x = canvas.width / 2 + horizontalAdjustment;
                            y = canvas.height / 2 + verticalAdjustment;
                            break;
                        case 'bottomRight':
                            x = canvas.width - padding + horizontalAdjustment;
                            y = canvas.height - padding + verticalAdjustment;
                            ctx.textAlign = 'right';
                            ctx.textBaseline = 'bottom';
                            break;
                        case 'bottomLeft':
                            x = padding + horizontalAdjustment;
                            y = canvas.height - padding + verticalAdjustment;
                            ctx.textAlign = 'left';
                            ctx.textBaseline = 'bottom';
                            break;
                        case 'topRight':
                            x = canvas.width - padding + horizontalAdjustment;
                            y = padding + verticalAdjustment;
                            ctx.textAlign = 'right';
                            ctx.textBaseline = 'top';
                            break;
                        case 'topLeft':
                            x = padding + horizontalAdjustment;
                            y = padding + verticalAdjustment;
                            ctx.textAlign = 'left';
                            ctx.textBaseline = 'top';
                            break;
                         default: // Should not happen with select element
                            x = canvas.width / 2 + horizontalAdjustment; // Default to center
                            y = canvas.height / 2 + verticalAdjustment;
                            break;
                    }
                     lines.forEach((line, index) => {
                        // Adjust Y offset based on baseline and line number
                        let currentY = y;
                         if (lines.length > 1) {
                            const totalTextBlockHeight = lineHeight * lines.length;
                            const firstLineY = y - (totalTextBlockHeight / 2) + (lineHeight / 2);
                            currentY = firstLineY + index * lineHeight;
                         }
                         // For bottom baseline, need to adjust Y differently for multiline
                         if (position.startsWith('bottom')) {
                             const totalTextBlockHeight = lineHeight * lines.length;
                             const firstLineY = y + (totalTextBlockHeight / 2) - (lineHeight / 2);
                             currentY = firstLineY - index * lineHeight; // Draw upwards from the base Y
                         }

                        ctx.fillText(line, x, currentY);
                    });
                }

                // Generate filename
                const newFilename = generateUniqueFilename(file.name, existingFilenames);

                // Convert canvas to Blob and resolve the promise with a File object
                canvas.toBlob(function(blob) {
                    if (blob) {
                        resolve(new File([blob], newFilename, { type: blob.type }));
                    } else {
                        reject(new Error('Failed to create Blob from canvas.'));
                    }
                }, file.type || 'image/png'); // Use original file type or default to png
            };
            img.onerror = function() {
                reject(new Error('Failed to load image for processing.'));
            };
            img.src = e.target.result; // Start loading the image
        };
        reader.onerror = function() {
            reject(new Error('Failed to read file.'));
        };
        reader.readAsDataURL(file); // Start reading the file
    });
}

// 创建滑块控件
function createSliderControl(id, label, min, max, defaultValue, onChange) {
    const container = document.createElement('div');
    container.className = 'slider-control';

    const labelElement = document.createElement('label');
    labelElement.className = 'block text-gray-700 text-sm font-bold mb-2';
    labelElement.textContent = label;
    container.appendChild(labelElement);

    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'flex items-center space-x-2';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = id;
    slider.min = min;
    slider.max = max;
    slider.value = defaultValue;
    slider.className = 'flex-1';
    slider.addEventListener('input', (e) => onChange(parseInt(e.target.value)));

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'text-sm text-gray-600 w-12 text-right';
    valueDisplay.textContent = defaultValue;

    slider.addEventListener('input', (e) => {
        valueDisplay.textContent = e.target.value;
    });

    sliderContainer.appendChild(slider);
    sliderContainer.appendChild(valueDisplay);
    container.appendChild(sliderContainer);

    return container;
}

// 更新水印位置
function updateWatermarkPosition(canvas, originalImg, previewImg, uniqueId) {
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

    ctx.fillStyle = `rgba(${parseInt(color.slice(1,3),16)}, ${parseInt(color.slice(3,5),16)}, ${parseInt(color.slice(5,7),16)}, ${opacity})`;
    ctx.font = `${size}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines = text.split('\n');
    const lineHeight = size * 1.2;

    // 获取当前图片的所有滑块值
    const hSpacing = parseInt(document.getElementById(`${uniqueId}-horizontal-spacing`).value);
    const vSpacing = parseInt(document.getElementById(`${uniqueId}-vertical-spacing`).value);
    const hPosition = parseInt(document.getElementById(`${uniqueId}-horizontal-position`).value);
    const vPosition = parseInt(document.getElementById(`${uniqueId}-vertical-position`).value);

    if (position === 'tile') {
        const angle = -Math.PI / 4;
        // Calculate the max width and height of the watermark text (for multi-line)
        let maxTextWidth = 0;
        lines.forEach(line => {
            const w = ctx.measureText(line).width;
            if (w > maxTextWidth) maxTextWidth = w;
        });
        const textBlockHeight = lineHeight * lines.length;
        // Add some padding
        const cellWidth = Math.max(canvas.width / density, maxTextWidth + 20);
        const cellHeight = Math.max(canvas.height / density, textBlockHeight + 20);

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
}

// Add debounce function for slider performance optimization
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Add function to update watermark position for preview items
function updateWatermarkPositionForPreview(previewItem, file, uniqueId, value, direction) {
    // Store the adjustment values in the preview item's data
    if (!previewItem.watermarkAdjustments) {
        previewItem.watermarkAdjustments = { horizontal: 0, vertical: 0 };
    }
    previewItem.watermarkAdjustments[direction] = value;
    
    // Add visual feedback to show slider is active
    const slider = document.getElementById(`${uniqueId}-${direction}-position`);
    if (slider) {
        const min = parseInt(slider.min);
        const max = parseInt(slider.max);
        const percentage = ((value - min) / (max - min)) * 100;
        slider.style.background = `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`;
    }
    
    // Use debounced reprocessing for better performance
    if (!previewItem.debouncedReprocess) {
        previewItem.debouncedReprocess = debounce(() => {
            reprocessImageWithAdjustments(previewItem, file, uniqueId);
        }, 300); // 300ms delay
    }
    
    previewItem.debouncedReprocess();
}

// Function to reprocess image with position adjustments
async function reprocessImageWithAdjustments(previewItem, file, uniqueId) {
    try {
        const adjustments = previewItem.watermarkAdjustments || { horizontal: 0, vertical: 0 };
        // Use the original file for reprocessing
        const originalFile = previewItem.originalFile || file;
        
        console.log('Reprocessing image with adjustments:', adjustments);
        console.log('Original file:', originalFile);
        console.log('Current file:', file);
        
        // Add visual feedback
        const previewImg = previewItem.querySelector('.preview-image');
        if (previewImg) {
            previewImg.style.opacity = '0.7';
            previewImg.style.transition = 'opacity 0.2s ease';
        }
        
        const reprocessedFile = await processImage(originalFile, {}, adjustments);
        console.log('Reprocessed file:', reprocessedFile);
        
        // Update the preview image
        if (previewImg) {
            previewImg.src = URL.createObjectURL(reprocessedFile);
            previewImg.style.opacity = '1';
        }
        
        // Update the file in processedFiles array
        const fileIndex = processedFiles.findIndex(f => f === file);
        if (fileIndex > -1) {
            processedFiles[fileIndex] = reprocessedFile;
            console.log('Updated processedFiles array at index:', fileIndex);
        }
        
        // Update the download link to use the new reprocessed file
        const downloadLink = previewItem.querySelector('.download-button');
        if (downloadLink) {
            downloadLink.href = URL.createObjectURL(reprocessedFile);
            downloadLink.download = reprocessedFile.name;
            console.log('Updated download link');
        }
        
        // Update the filename input if it exists
        const filenameInput = previewItem.querySelector('input[type="text"]');
        if (filenameInput) {
            filenameInput.value = reprocessedFile.name;
        }
        
    } catch (error) {
        console.error('Error reprocessing image with adjustments:', error);
        ToastManager.showError('Failed to update watermark position');
        
        // Reset opacity on error
        const previewImg = previewItem.querySelector('.preview-image');
        if (previewImg) {
            previewImg.style.opacity = '1';
        }
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
imageModal.addEventListener('click', function() {
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
    clearButton.textContent = translations[currentLang].clearAll || '清除所有';
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
    const files = Array.from(e.target.files);
    handleFiles(files);
}

function handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files = [];
    for (const item of items) {
        if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file && (isImageFile(file.name) || isVideoFile(file.name))) {
                files.push(file);
            }
        }
    }
    handleFiles(files);
}

// 修改 updateFileNameDisplay 函数
function updateFileNameDisplay() {
    const fileNameDisplay = document.querySelector('.file-status-container span[data-i18n="noFileChosen"]');
    
    if (uploadedFiles.length > 0) {
        const fileCount = uploadedFiles.length;
        const filesSelectedText = fileCount === 1 
            ? translations[currentLang].fileSelected 
            : translations[currentLang].filesSelected;
        fileNameDisplay.textContent = `${fileCount} ${filesSelectedText}`;
    } else {
        fileNameDisplay.textContent = translations[currentLang].noFileChosen;
    }
}

// 修改 updateImagePreview 函数
function updateImagePreview() {
    imagePreviewArea.innerHTML = ''; // 清空现有预览
    imagePreviewArea.classList.remove('hidden');

    uploadedFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function(e) {
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
                uploadedFiles.splice(index, 1);
                updateFileInput();
                updateFileNameDisplay();
                updateImagePreview();
            };
            previewWrapper.appendChild(deleteButton);
            
            imagePreviewArea.appendChild(previewWrapper);
        }
        reader.readAsDataURL(file);
    });
}

// 添加重置函数
function resetAll() {
    uploadedFiles = [];
    lastUploadDirectory = null;
    processedFiles = [];
    fileMapping.clear(); // Clear the file mapping
    updateFileInput();
    updateFileNameDisplay();
    updateImagePreview();
    document.getElementById('watermarkText').value = '';
    document.getElementById('watermarkPosition').value = 'tile'; // 重置水印位置
    document.getElementById('watermarkDensity').value = '3';
    document.getElementById('watermarkDensity').disabled = false;
    document.getElementById('watermarkColor').value = '#dedede';
    document.getElementById('watermarkSize').value = '5'; // Default to 5% of image size
    updateColorPreview();
    previewContainer.innerHTML = '';
    // 重置时隐藏结果部分
    resultSection.classList.add('hidden');
    document.getElementById('watermarkPosition').value = 'tile';
    document.getElementById('watermarkDensity').disabled = false;
    updateWatermarkDensityOptions(false);
    toggleWatermarkDensity();
    document.getElementById('watermarkOpacity').value = '80';
}

function updateFileInput() {
    const dt = new DataTransfer();
    uploadedFiles.forEach(file => dt.items.add(file));
    document.getElementById('imageInput').files = dt.files;
}

async function downloadAllImages() {
    console.log('Download all files triggered');

    if (processedFiles.length === 0) {
        alert(translations[currentLang].noFilesToDownload || 'No files to download.');
        return;
    }

    const zip = new JSZip();
    const watermarkTextValue = watermarkText.value || 'watermarked';
    const timestamp = getFormattedTimestamp();
    const zipFilename = `${watermarkTextValue}-${timestamp}.zip`;

    try {
        for (const file of processedFiles) {
            // Add each processed File object to the zip
            zip.file(file.name, file, { binary: true });
        }

        // Generate and download zip file
        const content = await zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: { level: 9 }
        });
        FileSaver.saveAs(content, zipFilename);

    } catch (error) {
        console.error('Download error:', error);
        alert(translations[currentLang].downloadError || 'Download error, please try again.');
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
    processButton.textContent = translations[currentLang].processImagesShort;
    resetButton.textContent = translations[currentLang].resetButtonShort;
  } else {
    processButton.textContent = translations[currentLang].processImages;
    resetButton.textContent = translations[currentLang].resetButton;
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
    const currentLang = document.documentElement.lang;
    
    if (singleWatermark) {
        watermarkDensity.innerHTML = `<option value="1">${translations[currentLang].singleWatermark}</option>`;
    } else {
        watermarkDensity.innerHTML = `
            <option value="2" data-i18n="twoByTwo">${translations[currentLang].twoByTwo}</option>
            <option value="3" selected data-i18n="threeByThree">${translations[currentLang].threeByThree}</option>
            <option value="4" data-i18n="fourByFour">${translations[currentLang].fourByFour}</option>
            <option value="5" data-i18n="fiveByFive">${translations[currentLang].fiveByFive}</option>
            <option value="6" data-i18n="sixBySix">${translations[currentLang].sixBySix}</option>
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
        showToast(translations[currentLang].imageCopied);
    } catch (err) {
        console.error('Failed to copy image: ', err);
        showToast(translations[currentLang].copyFailed);
    }
}

// 修改透明度输入验证
const watermarkOpacity = document.getElementById('watermarkOpacity');

// 在输入时只做基本的字符验证
watermarkOpacity.addEventListener('input', function(e) {
    // 移除非数字字符
    this.value = this.value.replace(/[^\d]/g, '');
});

// 在失去焦点时进行值的范围验证
watermarkOpacity.addEventListener('blur', function(e) {
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

    const items = Array.from(e.dataTransfer.items);
    const newFiles = [];
    
    for (const item of items) {
        if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry();
            if (entry) {
                if (entry.isDirectory) {
                    // Store directory entry for later use
                    lastUploadDirectory = entry;
                    // Process directory
                    const files = await getAllFilesFromDirectory(entry);
                    newFiles.push(...files);
                } else if (entry.isFile) {
                    const file = item.getAsFile();
                    newFiles.push(file);
                }
            }
        }
    }

    if (newFiles.length === 0) {
        ToastManager.showWarning(translations[currentLang].noValidImages || '请拖入图片文件或文件夹', this);
        return;
    }

    uploadedFiles = uploadedFiles.concat(newFiles);
    updateFileNameDisplay();
    updateImagePreview();
}

function handleFiles(files) {
    const filesArray = Array.from(files);
    const validFilesToAdd = [];

    for (const item of filesArray) {
        let file = null;

        // Handle items from DataTransfer (drag/paste)
        if (item && typeof item === 'object' && item.kind === 'file' && typeof item.getAsFile === 'function') {
            file = item.getAsFile();
        } else if (item instanceof File) {
            // Handle items directly from file input
            file = item;
        }

        // Check if we got a valid File object with a name
        if (file instanceof File && file.name) {
            // Check if it's an image or video file
            if (isImageFile(file.name) || isVideoFile(file.name)) {
                validFilesToAdd.push(file);
            } else {
                console.warn('Skipping non-image/video file:', file.name);
            }
        } else {
            console.warn('Skipping invalid item during file handling:', item);
        }
    }

    if (validFilesToAdd.length === 0 && uploadedFiles.length === 0) {
        // If no valid files were added and the list was already empty, show generic warning
         ToastManager.showWarning(translations[currentLang].invalidFileType);
         return;
    } else if (validFilesToAdd.length === 0 && uploadedFiles.length > 0) {
        // If no valid files were added but there are already files, maybe the dropped/pasted items were just invalid
         ToastManager.showWarning(translations[currentLang].noImageOrVideoFiles);
         return;
    }

    // Combine existing files with new valid files to add
    let filesAfterAddition = uploadedFiles.concat(validFilesToAdd);

    // Ensure uploadedFiles only contains unique files (based on name and size)
    const uniqueFiles = [];
    const fileHashes = new Set();
    filesAfterAddition.forEach(file => {
        const hash = `${file.name}-${file.size}`;
        if (!fileHashes.has(hash)) {
            uniqueFiles.push(file);
            fileHashes.add(hash);
        }
    });
    uploadedFiles = uniqueFiles;

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
        
        // Check if createReader is available
        if (!dirEntry.createReader) {
            reject(new Error('Directory reading not supported'));
            return;
        }
        
        const reader = dirEntry.createReader();
        
        function readEntries() {
            reader.readEntries(async (entries) => {
                if (!entries || entries.length === 0) {
                    resolve(files);
                    return;
                }

                for (const entry of entries) {
                    if (entry.isFile) {
                        try {
                            const file = await getFileFromEntry(entry);
                            if (isImageFile(file.name) || isVideoFile(file.name)) {
                                files.push(file);
                            }
                        } catch (error) {
                            console.error('Error getting file:', error);
                        }
                    } else if (entry.isDirectory) {
                        try {
                            const subDirFiles = await getAllFilesFromDirectory(entry);
                            files.push(...subDirFiles);
                        } catch (error) {
                            console.error('Error reading subdirectory:', error);
                        }
                    }
                }

                // Continue reading if there are more entries
                readEntries();
            }, (error) => {
                console.error('Error reading directory entries:', error);
                // Resolve with whatever files we've collected so far
                resolve(files);
            });
        }

        readEntries();
    });
}

// Helper function to get file from FileEntry
function getFileFromEntry(entry) {
    return new Promise((resolve, reject) => {
        if (!entry.file) {
            reject(new Error('File reading not supported'));
            return;
        }
        entry.file(resolve, reject);
    });
}

// Save current watermark settings to localStorage
function saveSettings() {
    const settings = {
        text: watermarkText.value,
        position: watermarkPosition.value,
        density: watermarkDensity.value,
        color: watermarkColor.value,
        size: watermarkSize.value,
        opacity: watermarkOpacity.value
    };
    localStorage.setItem('lastWatermarkSettings', JSON.stringify(settings));
}

// Download a File object (image or video)
function downloadFile(file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name || 'download';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}
