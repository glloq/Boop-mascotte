/**
 * The shipped hand sets, generated from `project/assets/hands/`.
 *
 * Do not edit. The **files** are the source of truth: edit a gesture's SVG,
 * or drop a new one in beside it, then run `npm run hands:sets`.
 * `hand-sets.test.js` re-reads the directory and fails if this and the files
 * have parted company.
 */
export const HAND_SETS = Object.freeze([
  {
    "manifest": {
      "format": "boop-hand-set",
      "version": 1,
      "set": "defaultCartoon",
      "name": "Cartoon gloves",
      "look": "glove",
      "viewBox": "0 0 200 200",
      "pivot": [
        100,
        100
      ],
      "scale": 2,
      "radius": 45.3,
      "defaultScale": 1,
      "fallback": "relaxed",
      "gestures": [
        {
          "id": "relaxed",
          "label": "Relaxed",
          "src": "relaxed.svg",
          "mirrorable": true,
          "roles": {
            "index": "Index",
            "middle": "Middle",
            "ring": "Ring",
            "thumb": "Thumb",
            "palm": "Palm"
          },
          "paletteRoles": {
            "index": {
              "fill": "skin",
              "stroke": "outline"
            },
            "middle": {
              "fill": "skin",
              "stroke": "outline"
            },
            "ring": {
              "fill": "skin",
              "stroke": "outline"
            },
            "thumb": {
              "fill": "skin",
              "stroke": "outline"
            },
            "palm": {
              "fill": "skin",
              "stroke": "outline"
            }
          },
          "anchors": {
            "index": [
              -17.5,
              -25.5
            ],
            "middle": [
              -1.3,
              -29.5
            ],
            "ring": [
              14.9,
              -26.5
            ],
            "thumb": [
              -33,
              4
            ]
          }
        },
        {
          "id": "open",
          "label": "Open",
          "src": "open.svg",
          "mirrorable": true,
          "roles": {
            "index": "Index",
            "middle": "Middle",
            "ring": "Ring",
            "thumb": "Thumb",
            "palm": "Palm"
          },
          "paletteRoles": {
            "index": {
              "fill": "skin",
              "stroke": "outline"
            },
            "middle": {
              "fill": "skin",
              "stroke": "outline"
            },
            "ring": {
              "fill": "skin",
              "stroke": "outline"
            },
            "thumb": {
              "fill": "skin",
              "stroke": "outline"
            },
            "palm": {
              "fill": "skin",
              "stroke": "outline"
            }
          },
          "anchors": {
            "index": [
              -23.6,
              -31.3
            ],
            "middle": [
              -1.2,
              -37.5
            ],
            "ring": [
              21.2,
              -29.4
            ],
            "thumb": [
              -34,
              -1
            ]
          }
        },
        {
          "id": "fist",
          "label": "Fist",
          "src": "fist.svg",
          "mirrorable": true,
          "roles": {
            "palm": "Palm",
            "index": "Index",
            "middle": "Middle",
            "ring": "Ring",
            "thumb": "Thumb"
          },
          "paletteRoles": {
            "palm": {
              "fill": "skin",
              "stroke": "outline"
            },
            "index": {
              "fill": "skin",
              "stroke": "outline"
            },
            "middle": {
              "fill": "skin",
              "stroke": "outline"
            },
            "ring": {
              "fill": "skin",
              "stroke": "outline"
            },
            "thumb": {
              "fill": "skin",
              "stroke": "outline"
            }
          },
          "anchors": {
            "index": [
              -15.5,
              -19.5
            ],
            "middle": [
              0,
              -21.5
            ],
            "ring": [
              15.5,
              -19.5
            ],
            "thumb": [
              -6,
              7
            ]
          }
        },
        {
          "id": "point",
          "label": "Point",
          "src": "point.svg",
          "mirrorable": true,
          "roles": {
            "index": "Index",
            "palm": "Palm",
            "middle": "Middle",
            "ring": "Ring",
            "thumb": "Thumb"
          },
          "paletteRoles": {
            "index": {
              "fill": "skin",
              "stroke": "outline"
            },
            "palm": {
              "fill": "skin",
              "stroke": "outline"
            },
            "middle": {
              "fill": "skin",
              "stroke": "outline"
            },
            "ring": {
              "fill": "skin",
              "stroke": "outline"
            },
            "thumb": {
              "fill": "skin",
              "stroke": "outline"
            }
          },
          "anchors": {
            "index": [
              -14.9,
              -39.5
            ],
            "middle": [
              0,
              -17.5
            ],
            "ring": [
              15.5,
              -16.5
            ],
            "thumb": [
              -6,
              7
            ]
          }
        },
        {
          "id": "thumbsUp",
          "label": "Thumbs up",
          "src": "thumbsUp.svg",
          "mirrorable": true,
          "roles": {
            "thumb": "Thumb",
            "palm": "Palm",
            "fingers": "Fingers"
          },
          "paletteRoles": {
            "thumb": {
              "fill": "skin",
              "stroke": "outline"
            },
            "palm": {
              "fill": "skin",
              "stroke": "outline"
            },
            "fingers": {
              "fill": "skin",
              "stroke": "outline"
            }
          },
          "anchors": {
            "thumb": [
              -15,
              -30
            ],
            "fingers": [
              12,
              0
            ]
          }
        },
        {
          "id": "peace",
          "label": "Peace",
          "src": "peace.svg",
          "mirrorable": true,
          "roles": {
            "index": "Index",
            "middle": "Middle",
            "palm": "Palm",
            "ring": "Ring",
            "thumb": "Thumb"
          },
          "paletteRoles": {
            "index": {
              "fill": "skin",
              "stroke": "outline"
            },
            "middle": {
              "fill": "skin",
              "stroke": "outline"
            },
            "palm": {
              "fill": "skin",
              "stroke": "outline"
            },
            "ring": {
              "fill": "skin",
              "stroke": "outline"
            },
            "thumb": {
              "fill": "skin",
              "stroke": "outline"
            }
          },
          "anchors": {
            "index": [
              -24.7,
              -34.3
            ],
            "middle": [
              3.6,
              -37.5
            ],
            "ring": [
              15.5,
              -17.5
            ],
            "thumb": [
              -6,
              7
            ]
          }
        },
        {
          "id": "ok",
          "label": "OK",
          "src": "ok.svg",
          "mirrorable": true,
          "roles": {
            "middle": "Middle",
            "ring": "Ring",
            "palm": "Palm",
            "loop": "Ring"
          },
          "paletteRoles": {
            "middle": {
              "fill": "skin",
              "stroke": "outline"
            },
            "ring": {
              "fill": "skin",
              "stroke": "outline"
            },
            "palm": {
              "fill": "skin",
              "stroke": "outline"
            },
            "loop": {
              "fill": "skin",
              "stroke": "outline"
            }
          },
          "anchors": {
            "middle": [
              3.6,
              -36.5
            ],
            "ring": [
              19.9,
              -29.4
            ]
          }
        },
        {
          "id": "sideFist",
          "label": "Closed side",
          "src": "sideFist.svg",
          "mirrorable": true,
          "roles": {
            "palm": "Palm",
            "fingers": "Fingers",
            "thumb": "Thumb"
          },
          "paletteRoles": {
            "palm": {
              "fill": "skin",
              "stroke": "outline"
            },
            "fingers": {
              "fill": "skin",
              "stroke": "outline"
            },
            "thumb": {
              "fill": "skin",
              "stroke": "outline"
            }
          },
          "anchors": {
            "fingers": [
              13,
              -5
            ],
            "thumb": [
              -2,
              7
            ]
          }
        }
      ]
    },
    "files": {
      "relaxed.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 200\" width=\"200\" height=\"200\" data-hand-pivot=\"100 100\" data-hand-scale=\"2\"><g id=\"hand-relaxed\" data-name=\"Relaxed\"><path id=\"index\" data-name=\"Index\" d=\"M 54 113 L 51 65 C 50.6 56.6 56.8 49.6 65 49 C 73.4 48.6 80.4 54.8 81 63 L 84 111 C 84.4 119.4 78.2 126.4 70 127 C 61.6 127.4 54.6 121.2 54 113 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"middle\" data-name=\"Middle\" d=\"M 85 112.6 L 83 56.6 C 82.8 48.2 89.2 41.4 97.4 41 C 105.8 40.8 112.6 47.2 113 55.4 L 115 111.4 C 115.2 119.8 108.8 126.6 100.6 127 C 92.2 127.2 85.4 120.8 85 112.6 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"ring\" data-name=\"Ring\" d=\"M 116 112.2 L 115 62.2 C 114.8 54 121.4 47.2 129.8 47 C 138 46.8 144.8 53.4 145 61.8 L 146 111.8 C 146.2 120 139.6 126.8 131.2 127 C 123 127.2 116.2 120.6 116 112.2 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"thumb\" data-name=\"Thumb\" d=\"M 57.6 140.8 L 25.6 122.8 C 17.4 118.2 14.6 107.8 19.2 99.6 C 23.8 91.4 34.2 88.6 42.4 93.2 L 74.4 111.2 C 82.6 115.8 85.4 126.2 80.8 134.4 C 76.2 142.6 65.8 145.4 57.6 140.8 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"palm\" data-name=\"Palm\" d=\"M 86 76 L 114 76 C 132.8 76 148 91.2 148 110 L 148 122 C 148 140.8 132.8 156 114 156 L 86 156 C 67.2 156 52 140.8 52 122 L 52 110 C 52 91.2 67.2 76 86 76 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /></g></svg>",
      "open.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 200\" width=\"200\" height=\"200\" data-hand-pivot=\"100 100\" data-hand-scale=\"2\"><g id=\"hand-open\" data-name=\"Open\"><path id=\"index\" data-name=\"Index\" d=\"M 54.4 115.2 L 41.4 55.2 C 39.6 47 44.8 39 52.8 37.4 C 61 35.6 69 40.8 70.6 48.8 L 83.6 108.8 C 85.4 117 80.2 125 72.2 126.6 C 64 128.4 56 123.2 54.4 115.2 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"middle\" data-name=\"Middle\" d=\"M 85 112.4 L 83 40.4 C 82.8 32.2 89.4 25.2 97.6 25 C 105.8 24.8 112.8 31.4 113 39.6 L 115 111.6 C 115.2 119.8 108.6 126.8 100.4 127 C 92.2 127.2 85.2 120.6 85 112.4 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"ring\" data-name=\"Ring\" d=\"M 116.2 109.6 L 125.2 53.6 C 126.6 45.4 134.2 39.8 142.4 41.2 C 150.6 42.6 156.2 50.2 154.8 58.4 L 145.8 114.4 C 144.4 122.6 136.8 128.2 128.6 126.8 C 120.4 125.4 114.8 117.8 116.2 109.6 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"thumb\" data-name=\"Thumb\" d=\"M 61 135.6 L 23 113.6 C 14.4 108.6 11.4 97.6 16.4 89 C 21.4 80.4 32.4 77.4 41 82.4 L 79 104.4 C 87.6 109.4 90.6 120.4 85.6 129 C 80.6 137.6 69.6 140.6 61 135.6 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"palm\" data-name=\"Palm\" d=\"M 86 76 L 114 76 C 132.8 76 148 91.2 148 110 L 148 122 C 148 140.8 132.8 156 114 156 L 86 156 C 67.2 156 52 140.8 52 122 L 52 110 C 52 91.2 67.2 76 86 76 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /></g></svg>",
      "fist.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 200\" width=\"200\" height=\"200\" data-hand-pivot=\"100 100\" data-hand-scale=\"2\"><g id=\"hand-fist\" data-name=\"Fist\"><path id=\"palm\" data-name=\"Palm\" d=\"M 86 76 L 114 76 C 132.8 76 148 91.2 148 110 L 148 122 C 148 140.8 132.8 156 114 156 L 86 156 C 67.2 156 52 140.8 52 122 L 52 110 C 52 91.2 67.2 76 86 76 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"index\" data-name=\"Index\" d=\"M 54 112 L 54 76 C 54 67.8 60.8 61 69 61 C 77.2 61 84 67.8 84 76 L 84 112 C 84 120.2 77.2 127 69 127 C 60.8 127 54 120.2 54 112 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"middle\" data-name=\"Middle\" d=\"M 85 112 L 85 72 C 85 63.8 91.8 57 100 57 C 108.2 57 115 63.8 115 72 L 115 112 C 115 120.2 108.2 127 100 127 C 91.8 127 85 120.2 85 112 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"ring\" data-name=\"Ring\" d=\"M 116 112 L 116 76 C 116 67.8 122.8 61 131 61 C 139.2 61 146 67.8 146 76 L 146 112 C 146 120.2 139.2 127 131 127 C 122.8 127 116 120.2 116 112 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"thumb\" data-name=\"Thumb\" d=\"M 44.4 113 L 82.4 99 C 90.8 96 100 100.2 103 108.4 C 106 116.8 101.8 126 93.6 129 L 55.6 143 C 47.2 146 38 141.8 35 133.6 C 32 125.2 36.2 116 44.4 113 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /></g></svg>",
      "point.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 200\" width=\"200\" height=\"200\" data-hand-pivot=\"100 100\" data-hand-scale=\"2\"><g id=\"hand-point\" data-name=\"Point\"><path id=\"index\" data-name=\"Index\" d=\"M 54 111.8 L 55 35.8 C 55.2 27.6 62 20.8 70.2 21 C 78.4 21.2 85.2 28 85 36.2 L 84 112.2 C 83.8 120.4 77 127.2 68.8 127 C 60.6 126.8 53.8 120 54 111.8 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"palm\" data-name=\"Palm\" d=\"M 86 76 L 114 76 C 132.8 76 148 91.2 148 110 L 148 122 C 148 140.8 132.8 156 114 156 L 86 156 C 67.2 156 52 140.8 52 122 L 52 110 C 52 91.2 67.2 76 86 76 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"middle\" data-name=\"Middle\" d=\"M 85 112 L 85 80 C 85 71.8 91.8 65 100 65 C 108.2 65 115 71.8 115 80 L 115 112 C 115 120.2 108.2 127 100 127 C 91.8 127 85 120.2 85 112 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"ring\" data-name=\"Ring\" d=\"M 116 112 L 116 82 C 116 73.8 122.8 67 131 67 C 139.2 67 146 73.8 146 82 L 146 112 C 146 120.2 139.2 127 131 127 C 122.8 127 116 120.2 116 112 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"thumb\" data-name=\"Thumb\" d=\"M 44.4 113 L 82.4 99 C 90.8 96 100 100.2 103 108.4 C 106 116.8 101.8 126 93.6 129 L 55.6 143 C 47.2 146 38 141.8 35 133.6 C 32 125.2 36.2 116 44.4 113 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /></g></svg>",
      "thumbsUp.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 200\" width=\"200\" height=\"200\" data-hand-pivot=\"100 100\" data-hand-scale=\"2\"><g id=\"hand-thumbsUp\" data-name=\"Thumbs up\"><path id=\"thumb\" data-name=\"Thumb\" d=\"M 59 116.8 L 55 40.8 C 54.6 32.6 61 25.4 69.2 25 C 77.4 24.6 84.6 31 85 39.2 L 89 115.2 C 89.4 123.4 83 130.6 74.8 131 C 66.6 131.4 59.4 125 59 116.8 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"palm\" data-name=\"Palm\" d=\"M 86 76 L 114 76 C 132.8 76 148 91.2 148 110 L 148 122 C 148 140.8 132.8 156 114 156 L 86 156 C 67.2 156 52 140.8 52 122 L 52 110 C 52 91.2 67.2 76 86 76 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"fingers\" data-name=\"Fingers\" d=\"M 78.2 77.2 L 126.2 83.2 C 135.4 84.2 142 92.8 140.8 102.2 C 139.8 111.4 131.2 118 121.8 116.8 L 73.8 110.8 C 64.6 109.8 58 101.2 59.2 91.8 C 60.2 82.6 68.8 76 78.2 77.2 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /></g></svg>",
      "peace.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 200\" width=\"200\" height=\"200\" data-hand-pivot=\"100 100\" data-hand-scale=\"2\"><g id=\"hand-peace\" data-name=\"Peace\"><path id=\"index\" data-name=\"Index\" d=\"M 54.4 115.4 L 39.4 49.4 C 37.6 41.2 42.6 33.2 50.6 31.4 C 58.8 29.6 66.8 34.6 68.6 42.6 L 83.6 108.6 C 85.4 116.8 80.4 124.8 72.4 126.6 C 64.2 128.4 56.2 123.4 54.4 115.4 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"middle\" data-name=\"Middle\" d=\"M 85 110.8 L 91 38.8 C 91.8 30.4 99 24.4 107.2 25 C 115.6 25.8 121.6 33 121 41.2 L 115 113.2 C 114.2 121.6 107 127.6 98.8 127 C 90.4 126.2 84.4 119 85 110.8 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"palm\" data-name=\"Palm\" d=\"M 86 76 L 114 76 C 132.8 76 148 91.2 148 110 L 148 122 C 148 140.8 132.8 156 114 156 L 86 156 C 67.2 156 52 140.8 52 122 L 52 110 C 52 91.2 67.2 76 86 76 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"ring\" data-name=\"Ring\" d=\"M 116 112 L 116 80 C 116 71.8 122.8 65 131 65 C 139.2 65 146 71.8 146 80 L 146 112 C 146 120.2 139.2 127 131 127 C 122.8 127 116 120.2 116 112 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"thumb\" data-name=\"Thumb\" d=\"M 44.4 113 L 82.4 99 C 90.8 96 100 100.2 103 108.4 C 106 116.8 101.8 126 93.6 129 L 55.6 143 C 47.2 146 38 141.8 35 133.6 C 32 125.2 36.2 116 44.4 113 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /></g></svg>",
      "ok.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 200\" width=\"200\" height=\"200\" data-hand-pivot=\"100 100\" data-hand-scale=\"2\"><g id=\"hand-ok\" data-name=\"OK\"><path id=\"middle\" data-name=\"Middle\" d=\"M 85 110.8 L 91 40.8 C 91.8 32.4 99 26.4 107.2 27 C 115.6 27.8 121.6 35 121 43.2 L 115 113.2 C 114.2 121.6 107 127.6 98.8 127 C 90.4 126.2 84.4 119 85 110.8 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"ring\" data-name=\"Ring\" d=\"M 116.2 110.2 L 123.2 54.2 C 124.2 46 131.6 40 139.8 41.2 C 148 42.2 154 49.6 152.8 57.8 L 145.8 113.8 C 144.8 122 137.4 128 129.2 126.8 C 121 125.8 115 118.4 116.2 110.2 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"palm\" data-name=\"Palm\" d=\"M 86 76 L 114 76 C 132.8 76 148 91.2 148 110 L 148 122 C 148 140.8 132.8 156 114 156 L 86 156 C 67.2 156 52 140.8 52 122 L 52 110 C 52 91.2 67.2 76 86 76 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"loop\" data-name=\"Ring\" d=\"M 60 41 C 75 41 87 53 87 68 C 87 83 75 95 60 95 C 45 95 33 83 33 68 C 33 53 45 41 60 41 Z M 60 54 C 52.2 54 46 60.2 46 68 C 46 75.8 52.2 82 60 82 C 67.8 82 74 75.8 74 68 C 74 60.2 67.8 54 60 54 Z\" fill=\"#ffffff\" fill-rule=\"evenodd\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /></g></svg>",
      "sideFist.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 200\" width=\"200\" height=\"200\" data-hand-pivot=\"100 100\" data-hand-scale=\"2\"><g id=\"hand-sideFist\" data-name=\"Closed side\"><path id=\"palm\" data-name=\"Palm\" d=\"M 86 76 L 114 76 C 132.8 76 148 91.2 148 110 L 148 122 C 148 140.8 132.8 156 114 156 L 86 156 C 67.2 156 52 140.8 52 122 L 52 110 C 52 91.2 67.2 76 86 76 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"fingers\" data-name=\"Fingers\" d=\"M 74.4 66.2 L 128.4 74.2 C 137 75.4 143.2 83.6 141.8 92.4 C 140.6 101 132.4 107.2 123.6 105.8 L 69.6 97.8 C 61 96.6 54.8 88.4 56.2 79.6 C 57.4 71 65.6 64.8 74.4 66.2 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /><path id=\"thumb\" data-name=\"Thumb\" d=\"M 55.2 111.8 L 91.2 99.8 C 99.2 97.2 107.6 101.4 110.2 109.2 C 112.8 117.2 108.6 125.6 100.8 128.2 L 64.8 140.2 C 56.8 142.8 48.4 138.6 45.8 130.8 C 43.2 122.8 47.4 114.4 55.2 111.8 Z\" fill=\"#ffffff\" stroke=\"#1b1b1b\" stroke-width=\"3.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\" /></g></svg>"
    }
  }
]);
