package com.eneclez.watchparty.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeBrowserPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
