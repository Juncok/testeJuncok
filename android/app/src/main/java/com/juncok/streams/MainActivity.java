package com.juncok.streams;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.google.android.gms.cast.framework.CastContext;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Initialize CastContext early to warm up discovery
        try {
            CastContext.getSharedInstance(this);
        } catch (Exception e) {
            // Log or ignore initialization error
        }
    }
}
