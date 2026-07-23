import os
import re

base_path = "/Users/superman/Desktop/gameall/party-hub/src/games/fakeArtist"

if not os.path.exists(os.path.join(base_path, "phases")):
    os.makedirs(os.path.join(base_path, "phases"))

# 1. Update GameRoom.tsx
game_room_path = "/Users/superman/Desktop/gameall/party-hub/src/pages/GameRoom.tsx"
with open(game_room_path, 'r') as f:
    gr = f.read()
gr = gr.replace("import('../games/FakeArtist')", "import('../games/fakeArtist')")
with open(game_room_path, 'w') as f:
    f.write(gr)

# 2. Extract index.tsx and phases
with open(os.path.join(base_path, "index.tsx"), "r") as f:
    content = f.read()

# Fix import
content = content.replace("from './logic/fakeArtistData'", "from '../logic/fakeArtistData'")
content = content.replace("from './logic/fakeArtistLogic'", "from '../logic/fakeArtistLogic'")

# I will save the original to parse or I can just use regex / string split to separate the JSX parts.
# Let's write the different phases out.
# Since it's complex, I'll print the start and end indices of the phases.
