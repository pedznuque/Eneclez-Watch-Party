package com.eneclez.watchparty.mobile;

import android.app.Activity;
import android.content.Intent;
import com.getcapacitor.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.PluginMethod;

@CapacitorPlugin(name = "NativeBrowser")
public class NativeBrowserPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url", "https://m.youtube.com/");
        Intent intent = new Intent(getActivity(), NativeBrowserActivity.class);
        intent.putExtra("url", url);
        startActivityForResult(call, intent, "nativeBrowserResult");
    }

    @ActivityCallback
    private void nativeBrowserResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        JSObject data = new JSObject();
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            Intent intent = result.getData();
            data.put("action", intent.getStringExtra("action"));
            data.put("url", intent.getStringExtra("url"));
            data.put("title", intent.getStringExtra("title"));
            call.resolve(data);
            return;
        }

        data.put("action", "cancel");
        call.resolve(data);
    }
}
