const defaultOptions = {
  partSize: 5 * 1024 * 1024 * 1024,
  parallelism: 3,
  retries: 3,
  retryBackoffTimeMs: (retry) => retry * retry * 1000,
};

export default class S3Multipart {
  constructor(options) {
    this.options = Object.assign({}, defaultOptions, options);
    this.createUpload = options.createUpload;
    this.getPartUrl = options.getPartUrl;
    this.completeUpload = options.completeUpload;

    if (!this.createUpload || !this.getPartUrl || !this.completeUpload) {
      throw new Error(
        "Incomplete options, missing createUpload/getPartUrl/completeUpload"
      );
    }
  }

  upload(file) {
    return this.createUpload(file).then((uploadId) => {
      const totalParts = Math.ceil(file.size / this.options.partSize);
      const etags = new Array(totalParts);
      const activeXhr = [];
      let partNumber = 0;
      let completedParts = 0;
      let totalSentBytes = 0;

      const onProgress = (sentBytes) => {
        totalSentBytes += sentBytes;
        if (this.options.onProgress) {
          this.options.onProgress(totalSentBytes, file.size);
        }
      };

      return new Promise((resolve, reject) => {
        const nextPart = () => {
          if (partNumber >= totalParts) {
            if (completedParts === totalParts) {
              return resolve();
            }
          } else {
            const currentPartNumber = ++partNumber;
            let attempt = 0;
            const tryUpload = () => {
              const [xhr, promise] = this.sendPart(
                uploadId,
                file,
                currentPartNumber,
                onProgress
              );
              activeXhr.push(xhr);

              promise
                .then((etag) => (etags[currentPartNumber - 1] = etag))
                .then(() => {
                  completedParts++;
                  const xhrIndex = activeXhr.indexOf(xhr);
                  activeXhr.splice(xhrIndex, 1);
                  nextPart();
                })
                .catch((err) => {
                  const xhrIndex = activeXhr.indexOf(xhr);
                  activeXhr.splice(xhrIndex, 1);

                  if (attempt++ < this.options.retries) {
                    const delay =
                      typeof this.options.retryBackoffTimeMs === "function"
                        ? this.options.retryBackoffTimeMs(attempt)
                        : this.options.retryBackoffTimeMs;
                    setTimeout(tryUpload, delay);
                  } else {
                    reject(err);
                  }
                });
            };

            tryUpload();
          }
        };

        for (let i = 0; i < this.options.parallelism; i++) {
          nextPart();
        }
      })
        .then(() => {
          return this.completeUpload(file, uploadId, etags);
        })
        .catch((err) => {
          for (let i = 0; i < activeXhr.length; i++) {
            activeXhr[i].abort();
          }
          throw err;
        });
    });
  }

  sendPart(uploadId, file, partNumber, onProgress) {
    const { partSize } = this.options;
    const partStart = (partNumber - 1) * partSize;
    const part = file.slice(partStart, partStart + partSize);
    const request = new XMLHttpRequest();
    return [
      request,
      this.getPartUrl(file, uploadId, partNumber, part.size).then((partUrl) => {
        return new Promise((resolve, reject) => {
          request.onreadystatechange = function () {
            if (request.readyState === 4) {
              if (request.status !== 200) {
                reject(
                  new Error(
                    "Unexpected response HTTP " +
                      request.status +
                      " " +
                      request.statusText
                  )
                );
              } else {
                resolve(request.getResponseHeader("ETag"));
              }
            }
          };

          let lastLoaded = 0;
          request.upload.onprogress = function (e) {
            const { loaded } = e;
            onProgress(loaded - lastLoaded);
            lastLoaded = loaded;
          };

          request.open("PUT", partUrl, true);
          request.setRequestHeader("Content-Type", "");
          request.send(part);
        });
      }),
    ];
  }
}
