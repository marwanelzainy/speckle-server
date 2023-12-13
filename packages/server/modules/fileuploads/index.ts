/* istanbul ignore file */
import { insertNewUploadAndNotify } from '@/modules/fileuploads/services/management'
import { streamWritePermissions } from '@/modules/shared/authz'
import { authMiddlewareCreator } from '@/modules/shared/middleware'
import { moduleLogger } from '@/logging/logging'
import { listenForImportUpdates } from '@/modules/fileuploads/services/resultListener'
import axios, { AxiosResponse } from 'axios'
import {
  getIgnoreMissingMigrations,
  getServerOrigin
} from '@/modules/shared/helpers/envHelper'
import { Express } from 'express'
import { z } from 'zod'

const blobUploadResultSchema = z.object({
  fileName: z.string(),
  fileSize: z.number().nullable().optional(),
  blobId: z.string(),
  uploadStatus: z.number(),
  formKey: z.string().optional(),
  uploadError: z.string().optional()
})

const blobResponseSchema = z.object({
  uploadResults: z.array(blobUploadResultSchema)
})

export type BlobUploadResult = z.infer<typeof blobUploadResultSchema>

type saveFileUploadsParams = {
  userId: string
  streamId: string
  branchName: string
  uploadResults: BlobUploadResult[]
}

const saveFileUploads = async ({
  userId,
  streamId,
  branchName,
  uploadResults
}: saveFileUploadsParams) => {
  await Promise.all(
    uploadResults.map(async (upload) => {
      await insertNewUploadAndNotify({
        fileId: upload.blobId,
        streamId,
        branchName,
        userId,
        fileName: upload.fileName,
        fileType: upload.fileName.split('.').pop() || 'unknown',
        fileSize: upload.fileSize || null
      })
    })
  )
}

export const init = async (app: Express) => {
  if (getIgnoreMissingMigrations()) {
    moduleLogger.warn('📄 FileUploads module is DISABLED')
    return
  } else {
    moduleLogger.info('📄 Init FileUploads module')
  }

  app.post(
    '/api/file/:fileType/:streamId/:branchName?',
    authMiddlewareCreator(streamWritePermissions),
    async (req, res) => {
      if (!req.context.userId) {
        res.status(401).send('Unauthorized. UserId is missing.')
        return
      }
      const userId = req.context.userId
      const branchName = req.params.branchName || 'main'
      req.log = req.log.child({
        streamId: req.params.streamId,
        userId,
        branchName
      })
      req.log.debug({ requestHeaders: req.headers }, 'Uploading file to stream.')

      let upstreamResponse: AxiosResponse
      try {
        upstreamResponse = await axios.post(
          `${getServerOrigin()}/api/stream/${req.params.streamId}/blob`,
          req,
          {
            headers: {
              Authorization: req.headers.authorization,
              'Content-Type': req.headers['content-type'], //includes the boundary string for multipart/form-data
              Accept: 'application/json'
            },
            validateStatus(status) {
              return status >= 200 && status < 500
            }
          }
        )
      } catch (err) {
        if (err instanceof Error) {
          req.log.error(
            { message: err.message, stack: err.stack },
            'Error while uploading blob.'
          )
          res.status(500).send(err.message)
        } else {
          req.log.error(err, 'Error while uploading blob.')
          res.status(500).send('Error while uploading blob.')
        }
        return
      }

      if (upstreamResponse.status !== 201) {
        // handle error
        req.log.error(
          {
            statusCode: upstreamResponse.status,
            path: `${getServerOrigin()}/api/stream/${req.params.streamId}/blob`
          },
          'Error while uploading file.'
        )
        res.status(upstreamResponse.status).send(upstreamResponse.data)
      }

      let blobResponse: z.infer<typeof blobResponseSchema>
      try {
        blobResponse = await blobResponseSchema.parseAsync(upstreamResponse.data)
        req.log.debug({ data: blobResponse }, 'Parsed blob response.')

        await saveFileUploads({
          userId,
          streamId: req.params.streamId,
          branchName,
          uploadResults: blobResponse.uploadResults
        })
        req.log.debug('Saved file uploads.')
        res.status(201).send(blobResponse)
      } catch (err) {
        req.log.error(err, 'Error while parsing blob response.')
        res.status(500).send('Error while parsing blob results.')
      }
    }
  )

  listenForImportUpdates()
}

export const finalize = () => {}
