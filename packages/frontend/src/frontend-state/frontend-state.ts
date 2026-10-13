import {check} from '@augment-vir/assert';
import {type AnyObject} from '@augment-vir/common';
import {Observable} from 'element-vir';
import {LocalDbClientValueUpdateEvent} from 'local-db-client';
import {createPiCameraLocalDbClient} from './frontend-clients/local-db.client.js';

export async function createFrontendState() {
    const localDbClient = await createPiCameraLocalDbClient();

    const rawFrontendStateObservable = new Observable({
        equalityCheck: check.strictEquals,
        defaultValue: {
            localDbClient,
        },
    });

    function update(
        this: void,
        updateValue: Partial<(typeof rawFrontendStateObservable)['value']> = {},
    ) {
        rawFrontendStateObservable.setValue({
            ...rawFrontendStateObservable.value,
            ...updateValue,
        });
    }

    const frontendStateObservable = Object.assign(
        rawFrontendStateObservable as AnyObject as Omit<
            typeof rawFrontendStateObservable,
            | 'equalityCheck'
            | 'getListenerCount'
            | 'listenToEvent'
            | 'removeAllListeners'
            | 'removeListener'
            | 'destroy'
            | 'setValue'
        >,
        {
            update,
            destroy() {
                localDbClient.destroy();
                rawFrontendStateObservable.destroy();
            },
        },
    );

    /** The client updates its values in place, so a fresh state object is what triggers renders. */
    localDbClient.listen(LocalDbClientValueUpdateEvent, () => {
        frontendStateObservable.update();
    });

    return frontendStateObservable;
}

export type FrontendStateObservable = Awaited<ReturnType<typeof createFrontendState>>;
