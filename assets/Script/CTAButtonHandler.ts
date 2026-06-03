// FILE: /assets/Scripts/CTAButtonHandler.ts

import { _decorator, Component, AudioSource, find, CCString, sys } from 'cc';
 
// Declare the mraid object to TypeScript to avoid compilation errors.
declare const mraid: any;
 
const { ccclass, property } = _decorator;
 
@ccclass('CTAButtonHandler')
export class CTAButtonHandler extends Component {
   
    @property({
        type: CCString,
        tooltip: 'The Google Play Store URL (Android).'
    })
    public androidUrl: string = "https://play.google.com/store/apps/details?id=games.urmobi.found.it&hl=en-US";

    @property({
        type: CCString,
        tooltip: 'The Apple App Store URL (iOS).'
    })
    public iosUrl: string = "https://apps.apple.com/us/app/found-it-hidden-object-game/id1643547847";

 
    private isMraidReady: boolean = false;
 
    onLoad() {
        // Check if the MRAID object is present in the environment
        if (typeof mraid !== 'undefined') {
            console.log("MRAID environment detected.");
            // As per MRAID spec, wait for the 'ready' event before using any mraid functions.
            if (mraid.getState() === 'loading') {
                console.log("MRAID is loading. Waiting for the 'ready' event...");
                mraid.addEventListener('ready', this.onMraidReady.bind(this));
            } else {
                // If state is already 'default', 'expanded', etc., we are ready to go.
                this.onMraidReady();
            }
        } else {
            console.warn("MRAID library not found. Clicks will use a fallback 'window.open'.");
        }
    }
 
    /**
     * This function is called once the MRAID environment is ready.
     */
    private onMraidReady(): void {
        console.log("MRAID is ready. Click-through will use mraid.open().");
        this.isMraidReady = true;
    }
 
    /**
     * This method should be linked to the CTA button's click event in the editor.
     */
    public onStoreButtonClicked(): void {
        console.log("Store button clicked!");
 
        // Determine correct URL based on Platform
        let finalUrl = this.androidUrl;
        
        // sys.os will detect if we are running on an iPhone/iPad
        if (sys.os === sys.OS.IOS || sys.os === sys.OS.OSX) {
            finalUrl = this.iosUrl;
        }

        // Standard practice: stop audio before redirecting
        const mainAudio = find("Canvas-001/GameCamera")?.getComponent(AudioSource);
        if (mainAudio) {
            mainAudio.stop();
        }
 
        // Use mraid.open() if the environment is ready (Primary method)
        if (this.isMraidReady) {
            console.log("Calling mraid.open() with URL:", finalUrl);
            mraid.open(finalUrl);
        } else {
            // Fallback for local testing or non-MRAID environments
            console.log(`FALLBACK: MRAID not available. Opening URL with window.open: ${finalUrl}`);
            window.open(finalUrl, "_blank");
        }
    }
}