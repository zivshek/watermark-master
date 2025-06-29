class VideoProcessor {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.preload = 'metadata'; // Ensure metadata is loaded
  }

  async processVideo(file, options) {
    const {
      watermarkText,
      position,
      color,
      size,
      opacity,
      quality,
      format,
      onProgress,
      density = 3
    } = options;

    return new Promise((resolve, reject) => {
      const videoUrl = URL.createObjectURL(file);
      this.video.src = videoUrl;

      this.video.onloadedmetadata = () => {
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        
        // Create canvas stream and add audio tracks from video
        const canvasStream = this.canvas.captureStream();
        // Try to get audio tracks from the video element
        if (this.video.captureStream) {
          const videoAudioStream = this.video.captureStream();
          const audioTracks = videoAudioStream.getAudioTracks();
          audioTracks.forEach(track => canvasStream.addTrack(track));
        }
        const mimeType = format === 'webm' ? 'video/webm' : 'video/mp4';
        const mediaRecorder = new MediaRecorder(canvasStream, {
          mimeType: mimeType,
          videoBitsPerSecond: this.getBitrate(quality)
        });

        const chunks = [];
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          URL.revokeObjectURL(videoUrl);
          resolve(blob);
        };

        // Wait for video to be ready before starting
        this.video.oncanplay = () => {
          // Start recording first, then play video
          mediaRecorder.start();
          
          // Small delay to ensure recorder is ready
          setTimeout(() => {
            this.video.play();
          }, 100);
        };

        const duration = this.video.duration;
        let lastReportedPercent = -1;
        let lastFrameTime = 0;
        let frameCount = 0;
        let processingQueue = [];
        let isProcessing = false;
        let hasEnded = false;
        let lastProcessTime = 0;
        let frameLag = 0;

        // Process frames at a controlled rate to prevent freezing
        const processFrame = async () => {
          if (this.video.ended || this.video.paused || hasEnded) {
            if (!hasEnded) {
              hasEnded = true;
              console.log('Video processing completed, stopping recorder');
              mediaRecorder.stop();
            }
            return;
          }

          // Check if video has reached the end
          if (this.video.currentTime >= duration - 0.1) {
            if (!hasEnded) {
              hasEnded = true;
              console.log('Video reached end, stopping recorder');
              mediaRecorder.stop();
            }
            return;
          }

          const currentTime = Date.now();
          const videoCurrentTime = this.video.currentTime;
          
          // Calculate frame lag to detect if we're falling behind
          if (lastProcessTime > 0) {
            const expectedTime = lastFrameTime + (currentTime - lastProcessTime) / 1000;
            frameLag = Math.max(0, videoCurrentTime - expectedTime);
          }

          // Only process if we have a new frame and video is ready
          if (this.video.readyState >= 2 && videoCurrentTime !== lastFrameTime) {
            lastFrameTime = videoCurrentTime;
            lastProcessTime = currentTime;
            frameCount++;

            // Draw video frame
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            // Add watermark (this is the potentially slow operation)
            this.addWatermark(watermarkText, position, color, size, opacity, density);
            
            // Report progress
            if (typeof onProgress === 'function' && duration > 0) {
              const percent = Math.min(100, Math.floor((videoCurrentTime / duration) * 100));
              if (percent !== lastReportedPercent) {
                onProgress(percent);
                lastReportedPercent = percent;
              }
            }

            // Adaptive frame rate based on lag
            let targetFPS = this.getTargetFPS(duration);
            
            // If we're falling behind, increase frame rate to catch up
            if (frameLag > 0.5) {
              targetFPS = Math.min(30, targetFPS * 1.5);
              console.log(`Frame lag detected: ${frameLag.toFixed(2)}s, increasing FPS to ${targetFPS}`);
            }
            
            const frameDelay = Math.max(16, 1000 / targetFPS); // Minimum 16ms delay
            
            // Use setTimeout instead of requestAnimationFrame for better control
            setTimeout(() => {
              if (!this.video.ended && !this.video.paused && !hasEnded) {
                processFrame();
              }
            }, frameDelay);
          } else {
            // If no new frame, continue checking but with a shorter delay
            setTimeout(() => {
              if (!this.video.ended && !this.video.paused && !hasEnded) {
                processFrame();
              }
            }, 8); // Faster checking when no new frame
          }
        };

        // Start processing frames when video starts playing
        this.video.onplay = () => {
          // Wait a bit for the first frame to be available
          setTimeout(() => {
            processFrame();
          }, 50);
        };

        // Add video ended event listener
        this.video.onended = () => {
          console.log('Video ended event triggered');
          if (!hasEnded) {
            hasEnded = true;
            mediaRecorder.stop();
          }
        };

        // Add timeout protection for very long videos
        const maxProcessingTime = Math.max(duration * 1000 * 1.5, 300000); // 1.5x video duration or 5 minutes max
        setTimeout(() => {
          if (!hasEnded) {
            console.log('Processing timeout reached, forcing stop');
            hasEnded = true;
            mediaRecorder.stop();
          }
        }, maxProcessingTime);

        // Handle video errors
        this.video.onerror = (error) => {
          console.error('Video error:', error);
          URL.revokeObjectURL(videoUrl);
          reject(new Error(`Video processing error: ${error.message || 'Unknown error'}`));
        };
      };

      this.video.onerror = (error) => {
        URL.revokeObjectURL(videoUrl);
        reject(error);
      };
    });
  }

  // Adaptive frame rate based on video duration
  getTargetFPS(duration) {
    if (duration <= 30) {
      return 30; // Short videos: 30fps
    } else if (duration <= 120) {
      return 25; // Medium videos: 25fps
    } else if (duration <= 300) {
      return 20; // Longer videos: 20fps
    } else {
      return 15; // Very long videos: 15fps
    }
  }

  addWatermark(text, position, color, size, opacity, density = 3) {
    const fontSize = (this.canvas.width * size) / 100;
    this.ctx.font = `${fontSize}px Arial`;
    this.ctx.fillStyle = color;
    this.ctx.globalAlpha = opacity / 100;

    const textMetrics = this.ctx.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = fontSize;

    let x, y;
    switch (position) {
      case 'center':
        x = (this.canvas.width - textWidth) / 2;
        y = (this.canvas.height - textHeight) / 2;
        break;
      case 'bottomRight':
        x = this.canvas.width - textWidth - 10;
        y = this.canvas.height - textHeight - 10;
        break;
      case 'bottomLeft':
        x = 10;
        y = this.canvas.height - textHeight - 10;
        break;
      case 'topRight':
        x = this.canvas.width - textWidth - 10;
        y = textHeight + 10;
        break;
      case 'topLeft':
        x = 10;
        y = textHeight + 10;
        break;
      case 'tile':
      default:
        // Place exactly density x density watermarks, evenly spaced
        const rows = density;
        const cols = density;
        const cellWidth = this.canvas.width / cols;
        const cellHeight = this.canvas.height / rows;
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const cx = (col + 0.5) * cellWidth;
            const cy = (row + 0.5) * cellHeight;
            this.ctx.save();
            // Optionally rotate for style, e.g., -45deg
            this.ctx.translate(cx, cy);
            this.ctx.rotate(-Math.PI / 12); // subtle tilt
            this.ctx.fillText(text, 0, 0);
            this.ctx.restore();
          }
        }
        return;
    }

    this.ctx.fillText(text, x, y);
  }

  getBitrate(quality) {
    switch (quality) {
      case 'high':
        return 8000000; // 8 Mbps
      case 'medium':
        return 4000000; // 4 Mbps
      case 'low':
        return 2000000; // 2 Mbps
      default:
        return 4000000; // Default to medium
    }
  }
}

export default VideoProcessor; 