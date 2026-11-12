"""Run Fabrication Toolkit's CLI headless. Run under KiCad 10's Python:
    python.exe export.py board.kicad_pcb

Zone fill is OFF here: rev0fix.py has already refilled with kicad-cli, which also rebuilt the
teardrops, so the Gerbers match exactly what DRC checked.
"""
import sys, os, importlib
import wx
app = wx.App(False); wx.Log.SetActiveTarget(wx.LogStderr())
sys.path.insert(0, os.path.expandvars(r"%USERPROFILE%\OneDrive\Documents\KiCad\10.0\3rdparty\plugins"))
sys.path.insert(0, os.path.expandvars(r"%USERPROFILE%\Documents\KiCad\10.0\3rdparty\plugins"))
pkg = "com_github_bennymeg_JLC-Plugin-for-KiCad"
th = importlib.import_module(pkg + ".thread")
op = importlib.import_module(pkg + ".options")
options = {op.AUTO_TRANSLATE_OPT: True, op.AUTO_FILL_OPT: False, op.EXCLUDE_DNP_OPT: False,
           op.EXTEND_EDGE_CUT_OPT: False, op.ALTERNATIVE_EDGE_CUT_OPT: False, op.ALL_ACTIVE_LAYERS_OPT: False,
           op.ARCHIVE_NAME: "", op.EXTRA_LAYERS: "", op.NO_BACKUP_OPT: True}
t = th.ProcessThread(wx=None, cli=sys.argv[1], options=options, openBrowser=False, nonInteractive=True)
t.join()
print("exported")
