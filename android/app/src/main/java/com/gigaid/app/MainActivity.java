package com.gigaid.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

import com.capacitorjs.plugins.filesystem.FilesystemPlugin;
import com.capacitorjs.plugins.share.SharePlugin;
import com.gigaid.app.sharetarget.ShareTargetPlugin;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(FilesystemPlugin.class);
    registerPlugin(SharePlugin.class);
    // Custom plugin (Task #119) that captures the chosen Android share
    // destination via Intent.EXTRA_CHOSEN_COMPONENT so the admin
    // share-funnel report can break down completions per app.
    registerPlugin(ShareTargetPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
