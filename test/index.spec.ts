import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import worker from '../src'

const qualcommPreset = {
  code: 200,
  msg: 'Success',
  data: {
    component_ids: [7, 8, 25, 345, 48],
    container_id: 2,
    container: {
      version: '1.0.3',
      version_code: 4,
      name: 'proton10.0-arm64x-2',
      file_md5: '6dcb13706c9c7720b074ee020ce39bbc',
      file_name: 'wine_proton10.0-arm64x-2.tar.zst',
      sub_data: {
        sub_file_md5: '439b7ec0ae13685aee76a10904ebccf4',
      },
    },
    execution_context: {
      params: ['Qualcomm', 750, 'Adreno (TM) 750', 2150604839, '6850', 2],
    },
  },
  time: '1760000000',
}

const genericPreset = {
  code: 200,
  msg: 'Success',
  data: {
    component_ids: [7, 8, 24, 345],
    container_id: 2,
    container: {
      version: '1.0.3',
      version_code: 4,
      name: 'proton10.0-arm64x-2',
      file_md5: '6dcb13706c9c7720b074ee020ce39bbc',
      file_name: 'wine_proton10.0-arm64x-2.tar.zst',
      sub_data: {
        sub_file_md5: '439b7ec0ae13685aee76a10904ebccf4',
      },
    },
    execution_context: {
      params: ['ARM', 78, 'Mali-G78', 0, '0', 2],
    },
  },
  time: '1760000000',
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  })
}

function executeScriptRequest(body: Record<string, unknown>): Request {
  return new Request<unknown, IncomingRequestCfProperties>(
    'http://example.com/simulator/executeScript',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

describe('POST /simulator/executeScript', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)

        if (url.endsWith('/simulator/executeScript/qualcomm')) {
          return Promise.resolve(jsonResponse(qualcommPreset))
        }

        if (url.endsWith('/simulator/executeScript/generic')) {
          return Promise.resolve(jsonResponse(genericPreset))
        }

        return Promise.resolve(new Response('Not found', { status: 404 }))
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the Qualcomm preset and keeps request context', async () => {
    const ctx = createExecutionContext()
    const response = await worker.fetch(
      executeScriptRequest({
        token: 'fake-token',
        sign: 'test',
        time: '1760032301893',
        game_id: '0',
        gpu_vendor: 'Qualcomm',
        gpu_version: 750,
        gpu_device_name: 'Adreno (TM) 750',
        gpu_system_driver_version: 615,
        game_type: 2,
      }),
      env,
      ctx,
    )
    await waitOnExecutionContext(ctx)

    const json = (await response.json()) as typeof qualcommPreset

    expect(response.status).toBe(200)
    expect(json.data.container.file_name).toBe(
      'wine_proton10.0-arm64x-2.tar.zst',
    )
    expect(json.data.container.version).toBe('1.0.3')
    expect(json.data.component_ids).toEqual([7, 8, 25, 345, 48])
    expect(json.data.execution_context.params).toEqual([
      'Qualcomm',
      750,
      'Adreno (TM) 750',
      615,
      '0',
      2,
    ])
  })

  it('uses the generic preset for non-Qualcomm GPUs', async () => {
    const ctx = createExecutionContext()
    const response = await worker.fetch(
      executeScriptRequest({
        game_id: '0',
        gpu_vendor: 'ARM',
        gpu_version: 78,
        gpu_device_name: 'Mali-G78',
        gpu_system_driver_version: 0,
        game_type: 1,
      }),
      env,
      ctx,
    )
    await waitOnExecutionContext(ctx)

    const json = (await response.json()) as typeof genericPreset

    expect(response.status).toBe(200)
    expect(json.data.container.file_name).toBe(
      'wine_proton10.0-arm64x-2.tar.zst',
    )
    expect(json.data.component_ids).toEqual([7, 8, 24, 345])
    expect(json.data.execution_context.params).toEqual([
      'ARM',
      78,
      'Mali-G78',
      0,
      '0',
      1,
    ])
  })
})
