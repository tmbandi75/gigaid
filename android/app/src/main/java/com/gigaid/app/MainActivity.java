package com.gigaid.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

import com.capacitorjs.plugins.filesystem.FilesystemPlugin;
import com.capacitorjs.plugins.share.SharePlugin;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(FilesystemPlugin.class);
    registerPlugin(SharePlugin.class);
    super.onCreate(savedInstanceState);
  }
}
