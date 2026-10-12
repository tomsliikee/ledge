// A plain maximised window, to have something that covers the desktop.
import Gtk from 'gi://Gtk?version=4.0';

const app = new Gtk.Application({application_id: 'test.ledge.Window'});
app.connect('activate', () => {
    const window = new Gtk.ApplicationWindow({application: app, title: 'A window', default_width: 900, default_height: 600});
    window.set_child(new Gtk.Label({label: 'A maximised window covers the desktop.'}));
    window.maximize();
    window.present();
});
app.run([]);
