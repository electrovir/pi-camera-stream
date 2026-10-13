import {cameraApi} from '@pi-camera-stream/common';
import {createApiImplementor} from '@rest-vir/host';
import {type H264Camera} from './camera/h264-camera.js';

export type BackendContext = {
    camera: H264Camera;
};

export const backendImplementor = createApiImplementor<BackendContext>()(cameraApi);
