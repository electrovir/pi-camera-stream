import {LocalDbClient} from 'local-db-client';
import {defineShape} from 'object-shape-tester';

export async function createPiCameraLocalDbClient() {
    return await LocalDbClient.createClient(
        {
            /** Clockwise degrees: 0, 90, 180, or 270. */
            cameraRotation: {
                shape: defineShape(0),
            },
        },
        {
            storeName: 'pi-camera-stream',
        },
    );
}

export type PiCameraLocalDbClient = Awaited<ReturnType<typeof createPiCameraLocalDbClient>>;
