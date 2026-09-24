sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageBox",
  "sap/m/MessageToast",
  "sap/m/Dialog",
  "sap/m/Input",
  "sap/m/DatePicker",
  "sap/m/Label",
  "sap/m/Button",
  "sap/m/Select",
  "sap/m/VBox",
  "sap/m/Text",
  "sap/ui/core/Item",
  "sap/ui/layout/form/SimpleForm"
], function (Controller, MessageBox, MessageToast, Dialog, Input, DatePicker, Label, Button, Select, VBox, Text, Item, SimpleForm) {
  "use strict";
  return Controller.extend("ouradventuremap.map.controller.Map", {

    onAfterRendering: function () {
      var that = this;

      this._oSupabase = supabase.createClient(
        "https://frzqitexdouanxvjpjrb.supabase.co",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyenFpdGV4ZG91YW54dmpwanJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5NzI0NTgsImV4cCI6MjEwNTU0ODQ1OH0.WJs4YhKW6AjJpTFbmxfjAOdyT9Rj5zt1OAOAHLmd8Zg"
      );

      this._oMap = L.map("leafletMap").setView([14.24, 121.05], 5);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap"
      }).addTo(this._oMap);

      this._loadPins();

      this._bPickMode = false;
      this._oMap.on("click", function (e) {
        if (that._bPickMode) {
          that._onLocationPicked(e.latlng);
        }
      });

      setTimeout(function () {
        that._oMap.invalidateSize();
      }, 300);

      this._aPlaylist = [
        { name: "APT Instrumental", file: "media/BGsong4.mp3" },
        { name: "Hush Instrumental", file: "media/BGsong.mp3" },
        { name: "YMMDCM Instrumental", file: "media/BGsong2.mp3" },
        { name: "Axel F Instrumental", file: "media/BGsong3.mp3" }
      ];

      this._iCurrentSongIndex = 0;
      this._oBgMusic = new Audio(this._aPlaylist[this._iCurrentSongIndex].file);
      this._oBgMusic.loop = true;
      this._bMusicPlaying = false;

      var that2 = this;
      var fnStartMusicOnFirstTouch = function () {
        that2._oBgMusic.play().then(function () {
          that2._bMusicPlaying = true;
          var oBtn = that2.byId("musicToggleBtn");
          if (oBtn) { oBtn.setIcon("sap-icon://media-pause"); }
        }).catch(function () {});
        document.removeEventListener("click", fnStartMusicOnFirstTouch);
        document.removeEventListener("touchstart", fnStartMusicOnFirstTouch);
      };
      document.addEventListener("click", fnStartMusicOnFirstTouch);
      document.addEventListener("touchstart", fnStartMusicOnFirstTouch);
    },

    onToggleMusic: function () {
      var oBtn = this.byId("musicToggleBtn");
      if (this._bMusicPlaying) {
        this._oBgMusic.pause();
        oBtn.setIcon("sap-icon://media-play");
      } else {
        this._oBgMusic.play().catch(function (oError) {
          MessageToast.show("Tap the button again to start music.");
        });
        oBtn.setIcon("sap-icon://media-pause");
      }
      this._bMusicPlaying = !this._bMusicPlaying;
    },

    onOpenPlaylist: function () {
      var that = this;

      if (!this._oPlaylistDialog) {
        var oList = new sap.m.List({
          mode: "SingleSelectMaster"
        });

        this._aPlaylist.forEach(function (oSong, iIndex) {
          oList.addItem(new sap.m.StandardListItem({
            title: oSong.name,
            type: "Active",
            press: function () {
              that._playSongAtIndex(iIndex);
              that._oPlaylistDialog.close();
            }
          }));
        });

        this._oPlaylistDialog = new Dialog({
          title: "Choose a Song",
          contentWidth: "20rem",
          content: [oList],
          beginButton: new Button({
            text: "Close",
            press: function () { that._oPlaylistDialog.close(); }
          })
        });
      }

      this._oPlaylistDialog.open();
    },

    _playSongAtIndex: function (iIndex) {
      var that = this;
      var bWasPlaying = this._bMusicPlaying;

      this._iCurrentSongIndex = iIndex;
      this._oBgMusic.pause();
      this._oBgMusic.src = this._aPlaylist[iIndex].file;
      this._oBgMusic.currentTime = 0;

      if (bWasPlaying) {
        this._oBgMusic.play().then(function () {
          that._bMusicPlaying = true;
        }).catch(function () {
          that._bMusicPlaying = false;
        });
      }

      var oBtn = this.byId("musicToggleBtn");
      if (oBtn) {
        oBtn.setIcon(this._bMusicPlaying ? "sap-icon://media-pause" : "sap-icon://media-play");
      }
    },

    _loadPins: function () {
      var that = this;

      this._oSupabase
        .from("AdventureMap")
        .select("*")
        .then(function (result) {
          if (result.error) {
            MessageBox.error("Failed to load pins: " + result.error.message);
            return;
          }
          result.data.forEach(function (oRow) {
            that._addMarkerToMap(oRow, oRow.AdventureId);
          });
        });
    },

    _getMarkerIcon: function (sMemoryType, bLocked) {
      if (bLocked) {
        return L.divIcon({
          className: "custom-pin-icon-locked",
          html: '<div style="background-color:#555;width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 0 3px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">' +
                '<span style="transform:rotate(45deg);font-size:12px;">🔒</span>' +
                '</div>',
          iconSize: [24, 24],
          iconAnchor: [12, 24]
        });
      }

      var mColors = {
        "Date": "#FF69B4",
        "Roadtrip": "#FFD700",
        "Next Date": "#FF0000",
        "Milestone": "#228B22",
        "Foodtrip": "#FFA500"
      };
      var sColor = mColors[sMemoryType] || "#808080";

      return L.divIcon({
        className: "custom-pin-icon",
        html: '<div style="background-color:' + sColor + ';width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 0 3px rgba(0,0,0,0.5);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 20]
      });
    },

    _addMarkerToMap: function (oData, sId) {
      var that = this;
      var bLocked = oData.AdventureDate ? (new Date(oData.AdventureDate) > new Date()) : false;

      var marker = L.marker([oData.Latitude, oData.Longitude], {
        icon: this._getMarkerIcon(oData.MemoryType, bLocked)
      }).addTo(this._oMap);

      marker.on("click", function () {
        that._oMap.flyTo([oData.Latitude, oData.Longitude], 17, { duration: 0.75 });
        if (bLocked) {
          that._showLockedPinOptions(oData, sId, marker);
        } else {
          that._showMemoryPopup(oData, sId, marker);
        }
      });

      if (!this._oMarkerLookup) {
        this._oMarkerLookup = {};
      }
      this._oMarkerLookup[sId] = { marker: marker, oData: oData, sId: sId };
    },

    _showMemoryPopup: function (oData, sId, marker) {
      var that = this;
      var sFormattedDate = "";
      if (oData.AdventureDate) {
        var oDate = new Date(oData.AdventureDate);
        sFormattedDate = oDate.toLocaleDateString("en-GB", {
          day: "numeric", month: "long", year: "numeric"
        });
      }

      if (this._oMemoryDialog) {
        this._oMemoryDialog.destroy();
      }

      var oVBox = new VBox({
        items: [
          new Text({ text: sFormattedDate }).addStyleClass("sapUiSmallMarginBottom"),
          new Text({ text: oData.Description })
        ]
      }).addStyleClass("sapUiSmallMargin");

      this._oMemoryDialog = new Dialog({
        title: oData.LocationName,
        contentWidth: "40rem",
        draggable: true,
        resizable: true,
        content: [oVBox],
        buttons: [
          new Button({
            text: "Edit",
            press: function () {
              that._oMemoryDialog.close();
              that._openEditDialog(oData, sId, marker);
            }
          }),
          new Button({
            text: "Delete",
            type: "Reject",
            press: function () {
              that._oMemoryDialog.close();
              that._confirmDeleteMemory(oData, sId, marker);
            }
          }),
          new Button({
            text: "Photo/Video",
            press: function () {
              that._showPhotoVideo(oData, sId);
            }
          }),
          new Button({
            text: "Close",
            press: function () { that._oMemoryDialog.close(); }
          })
        ]
      });

      this._oMemoryDialog.open();
    },

    _showLockedPinOptions: function (oData, sId, marker) {
      var that = this;

      MessageBox.show(
        "This memory is locked until " + new Date(oData.AdventureDate).toLocaleDateString("en-GB", {
          day: "numeric", month: "long", year: "numeric"
        }) + ".",
        {
          icon: MessageBox.Icon.NONE,
          title: oData.LocationName,
          actions: ["Edit Date/Details", MessageBox.Action.CLOSE],
          emphasizedAction: "Edit Date/Details",
          onClose: function (sAction) {
            if (sAction === "Edit Date/Details") {
              that._openEditDialog(oData, sId, marker);
            }
          }
        }
      );
    },

    _showPhotoVideo: function (oData, sId) {
      var that = this;

      if (!oData.PhotoUrl) {
        this._showAddPhotoDialog(oData, sId);
        return;
      }

      var sUrl = oData.PhotoUrl;
      var bIsImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(sUrl);
      var bIsYouTube = /youtube\.com|youtu\.be/i.test(sUrl);
      var oDriveMatch = sUrl.match(/drive\.google\.com\/file\/d\/([^/]+)/);

      var oContent;
      if (oDriveMatch) {
        var sDriveId = oDriveMatch[1];
        var sDriveEmbedUrl = "https://drive.google.com/file/d/" + sDriveId + "/preview";
        oContent = new sap.ui.core.HTML({
          content: '<iframe width="100%" height="400" src="' + sDriveEmbedUrl + '" frameborder="0" allow="autoplay"></iframe>'
        });
      } else if (bIsImage) {
        oContent = new sap.m.Image({ src: sUrl, width: "100%" });
      } else if (bIsYouTube) {
        var sEmbedUrl = sUrl.replace("watch?v=", "embed/");
        oContent = new sap.ui.core.HTML({
          content: '<iframe width="100%" height="360" src="' + sEmbedUrl + '" frameborder="0" allowfullscreen></iframe>'
        });
      } else {
        oContent = new sap.m.Link({ text: "Open link: " + sUrl, href: sUrl, target: "_blank" });
      }

      var oPhotoDialog = new Dialog({
        title: oData.LocationName + " — Photo/Video",
        contentWidth: "32rem",
        content: [oContent],
        beginButton: new Button({
          text: "Change Link",
          press: function () {
            oPhotoDialog.close();
            that._showAddPhotoDialog(oData, sId);
          }
        }),
        endButton: new Button({
          text: "Close",
          press: function () { oPhotoDialog.close(); }
        }),
        afterClose: function () { oPhotoDialog.destroy(); }
      });

      oPhotoDialog.open();
    },

    _showAddPhotoDialog: function (oData, sId) {
      var that = this;
      var oUrlInput = new Input({
        placeholder: "https://drive.google.com/file/d/1vIYYUDr0N7tUeGYm2GA9Jimi0uH3cRX8/view?usp=drive_link",
        value: oData.PhotoUrl || ""
      });

      var oAddDialog = new Dialog({
        title: "Add Photo/Video Link",
        contentWidth: "28rem",
        content: [
          new VBox({
            items: [
              new Text({ text: "Paste a photo or video link for \"" + oData.LocationName + "\":" }).addStyleClass("sapUiSmallMarginBottom"),
              oUrlInput
            ]
          }).addStyleClass("sapUiSmallMargin")
        ],
        beginButton: new Button({
          text: "Save",
          type: "Emphasized",
          press: function () {
            var sNewUrl = oUrlInput.getValue();

            that._oSupabase
              .from("AdventureMap")
              .update({ PhotoUrl: sNewUrl })
              .eq("AdventureId", sId)
              .then(function (result) {
                if (result.error) {
                  MessageBox.error("Failed to save: " + result.error.message);
                  return;
                }
                oData.PhotoUrl = sNewUrl;
                MessageToast.show("Saved!");
                oAddDialog.close();
              });
          }
        }),
        endButton: new Button({
          text: "Cancel",
          press: function () { oAddDialog.close(); }
        }),
        afterClose: function () { oAddDialog.destroy(); }
      });

      oAddDialog.open();
    },

    _confirmDeleteMemory: function (oData, sId, marker) {
      var that = this;
      MessageBox.confirm(
        "Delete \"" + oData.LocationName + "\"? This cannot be undone.",
        {
          title: "Delete Memory",
          onClose: function (sAction) {
            if (sAction === MessageBox.Action.OK) {
              that._deleteMemory(oData, sId, marker);
            }
          }
        }
      );
    },

    _deleteMemory: function (oData, sId, marker) {
      var that = this;

      this._oSupabase
        .from("AdventureMap")
        .delete()
        .eq("AdventureId", sId)
        .then(function (result) {
          if (result.error) {
            MessageBox.error("Failed to delete: " + result.error.message);
            return;
          }
          that._oMap.removeLayer(marker);
          MessageToast.show("Memory deleted.");
        });
    },

    _openEditDialog: function (oData, sId, marker) {
      var that = this;

      if (!this._oEditDialog) {
        this._oEditNameInput = new Input();
        this._oEditDescInput = new Input();
        this._oEditDatePicker = new DatePicker({
          valueFormat: "yyyy-MM-dd",
          displayFormat: "dd MMM yyyy"
        });
        this._oEditMemoryTypeSelect = new Select({
          items: [
            new Item({ key: "Date", text: "Date" }),
            new Item({ key: "Roadtrip", text: "Roadtrip" }),
            new Item({ key: "Next Date", text: "Next Date" }),
            new Item({ key: "Milestone", text: "Milestone" }),
            new Item({ key: "Foodtrip", text: "Foodtrip" })
          ]
        });
        this._oEditPhotoUrlInput = new Input({
          placeholder: "https://drive.google.com/file/d/1vIYYUDr0N7tUeGYm2GA9Jimi0uH3cRX8/view?usp=drive_link"
        });

        var oForm = new SimpleForm({
          content: [
            new Label({ text: "Location Name" }), this._oEditNameInput,
            new Label({ text: "Description" }), this._oEditDescInput,
            new Label({ text: "Date" }), this._oEditDatePicker,
            new Label({ text: "Memory Type" }), this._oEditMemoryTypeSelect,
            new Label({ text: "Photo/Video Link" }), this._oEditPhotoUrlInput
          ]
        });

        this._oEditDialog = new Dialog({
          title: "Edit Memory",
          content: [oForm],
          beginButton: new Button({
            text: "Save",
            type: "Emphasized",
            press: function () { that._onSaveEdit(); }
          }),
          endButton: new Button({
            text: "Cancel",
            press: function () { that._oEditDialog.close(); }
          })
        });
      }

      this._oEditingId = sId;
      this._oEditingData = oData;
      this._oEditingMarker = marker;

      this._oEditNameInput.setValue(oData.LocationName);
      this._oEditDescInput.setValue(oData.Description);
      this._oEditDatePicker.setValue(oData.AdventureDate);
      this._oEditMemoryTypeSelect.setSelectedKey(oData.MemoryType);
      this._oEditPhotoUrlInput.setValue(oData.PhotoUrl);

      this._oEditDialog.open();
    },

    _onSaveEdit: function () {
      var that = this;
      var oUpdatedFields = {
        LocationName: this._oEditNameInput.getValue(),
        Description: this._oEditDescInput.getValue(),
        AdventureDate: this._oEditDatePicker.getValue(),
        MemoryType: this._oEditMemoryTypeSelect.getSelectedKey(),
        PhotoUrl: this._oEditPhotoUrlInput.getValue()
      };

      this._oSupabase
        .from("AdventureMap")
        .update(oUpdatedFields)
        .eq("AdventureId", this._oEditingId)
        .then(function (result) {
          if (result.error) {
            MessageBox.error("Failed to save: " + result.error.message);
            return;
          }

          MessageToast.show("Saved!");
          that._oEditDialog.close();

          Object.assign(that._oEditingData, oUpdatedFields);

          if (that._oEditingMarker) {
            var bLocked = oUpdatedFields.AdventureDate ? (new Date(oUpdatedFields.AdventureDate) > new Date()) : false;
            that._oEditingMarker.setIcon(that._getMarkerIcon(oUpdatedFields.MemoryType, bLocked));
          }
        });
    },

    onAddAdventurePress: function () {
      this._bPickMode = true;
      MessageToast.show("Tap on the map to choose the location");
    },

    _onLocationPicked: function (oLatLng) {
      this._bPickMode = false;
      this._oPickedLatLng = oLatLng;
      this._openCreateDialog();
    },

    _openCreateDialog: function () {
      var that = this;

      if (!this._oCreateDialog) {
        this._oNameInput = new Input({ placeholder: "Location name" });
        this._oDescInput = new Input({ placeholder: "Description" });
        this._oDatePicker = new DatePicker({
          placeholder: "Date",
          valueFormat: "yyyy-MM-dd",
          displayFormat: "dd MMM yyyy"
        });
        this._oMemoryTypeSelect = new Select({
          items: [
            new Item({ key: "Date", text: "Date" }),
            new Item({ key: "Roadtrip", text: "Roadtrip" }),
            new Item({ key: "Next Date", text: "Next Date" }),
            new Item({ key: "Milestone", text: "Milestone" }),
            new Item({ key: "Foodtrip", text: "Foodtrip" })
          ]
        });

        this._oPhotoUrlInput = new Input({ placeholder: "https://drive.google.com/file/d/1vIYYUDr0N7tUeGYm2GA9Jimi0uH3cRX8/view?usp=drive_link" });

        var oForm = new SimpleForm({
          content: [
            new Label({ text: "Location Name" }), this._oNameInput,
            new Label({ text: "Description" }), this._oDescInput,
            new Label({ text: "Date" }), this._oDatePicker,
            new Label({ text: "Memory Type" }), this._oMemoryTypeSelect,
            new Label({ text: "Photo/Video Link" }), this._oPhotoUrlInput
          ]
        });

        this._oCreateDialog = new Dialog({
          title: "New Adventure",
          content: [oForm],
          beginButton: new Button({
            text: "Save",
            type: "Emphasized",
            press: function () { that._onSaveNewAdventure(); }
          }),
          endButton: new Button({
            text: "Cancel",
            press: function () { that._oCreateDialog.close(); }
          })
        });
      }

      this._oNameInput.setValue("");
      this._oDescInput.setValue("");
      this._oDatePicker.setValue("");
      this._oMemoryTypeSelect.setSelectedKey("Next Date");
      this._oPhotoUrlInput.setValue("");
      this._oCreateDialog.open();
    },

    _onSaveNewAdventure: function () {
      var that = this;

      var oNewData = {
        LocationName: this._oNameInput.getValue(),
        Description: this._oDescInput.getValue(),
        Latitude: this._oPickedLatLng.lat,
        Longitude: this._oPickedLatLng.lng,
        AdventureDate: this._oDatePicker.getValue(),
        MemoryType: this._oMemoryTypeSelect.getSelectedKey(),
        PhotoUrl: this._oPhotoUrlInput.getValue()
      };

      this._oSupabase
        .from("AdventureMap")
        .insert(oNewData)
        .select()
        .then(function (result) {
          if (result.error) {
            MessageBox.error("Failed to save: " + result.error.message);
            return;
          }

          MessageToast.show("New Memory Created!");
          that._oCreateDialog.close();

          var oInsertedRow = result.data[0];
          that._addMarkerToMap(oInsertedRow, oInsertedRow.AdventureId);
        });
    }

  });
});