s3-multipart
============

Features:

* S3 Multipart uploads directly from the browser
* Parallel transfer if needed
* Retries
* Progress information
* Configurable for your backend

For large file uploads, larger than 5GB, S3 has the concept of multipart uploads,
where the file is divided into smaller parts (max 5GB per chunk) and each part
is transferred individually. This concept is well known, well documented, but if
you want to do it directly from a browser, it is significantly less so.

To my knowledge, there are some other modules that does this, but had the wrong
kind of dependencies for my taste, or were hard to configure.

s3-multipart aims to be very small, and very easy configure to your needs.

*Note:* To do multipart uploads from the browser, you need to use presigned URLs. These URLs most likely will have to be presigned by some kind of backend that you control. You need to set this up, it is not a part of this module.

## API

The module exports a single class, `S3Multipart`:

```js
import S3Multipart from 's3-multipart'

const s3multipart = new S3Multipart({
  createUpload: (file) => { /* ...return promise... */ },
  getPartUrl: (file, uploadId, partNumber, partSize) => { /* ...return promise... */ },
  completeUpload: (file, uploadId, etags) => { /* ...return promise... */ },
  onProgress: (uploadedBytes, totalBytes) => { /* ... */ }
})

s3multipart.upload(myFile).then(() => console.log('success!'))
```

The class has three mandatory options: `createUpload`, `getPartUrl` and `completeUpload`. Each of them are expected to return a promise.

* `createUpload`: creates a multipart upload on S3; see [`CreateMultipartUpload`](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CreateMultipartUpload.html) for details. The function should return a promise that resolves to the newly created upload's id.
* `getPartUrl`: Returns a promise that resolves to a presigned URL for a `PUT` request to the given file and part number
* `completeUpload`: completes the multipart upload after each part has been transferred; see [`CompleteMultipartUpload`](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html) for details. In addition the file and upload id for the current transfer, the method also receives an array of the parts' `ETag` headers that is used by S3 to verify the integrity of each part you uploaded

Optional configuration:

* `onProgress`: callback to indicate how much of the file has been transferred
* `partSize`: number of bytes for each part; must be at least 5 MB and maximum 5 GB; default is 5 GB.
* `parallelism`: number of parts to attempt to transfer simulatenously; defaults to `3`.
