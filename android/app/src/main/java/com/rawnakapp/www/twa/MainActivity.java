package com.rawnakapp.www.twa;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Android 15 enforces edge-to-edge for targetSdk 35+, while this
        // call provides the same behavior on older supported releases.
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
    }
}
