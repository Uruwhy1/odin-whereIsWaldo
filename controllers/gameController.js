const prisma = require("../prismaClient");

const setUpGame = async (req, res) => {
  try {
    // select characters
    const selectedCharacters = await prisma.character.findMany({
      take: 3,
      orderBy: {
        id: "asc",
      },
    });

    // create placeholder game
    const newGame = await prisma.game.create({
      data: {
        username: "placeholder",
        startDate: new Date(),
      },
    });

    // link characters and game
    const gameCharacterLinks = selectedCharacters.map((character) => ({
      gameId: newGame.id,
      characterId: character.id,
      found: false,
    }));

    await prisma.gameCharacter.createMany({
      data: gameCharacterLinks,
    });

    return res.status(200).json({
      gameId: newGame.id,
      characterIds: selectedCharacters.map((character) => character.id),
    });
  } catch (error) {
    console.error("Error setting up the game:", error);
    return res.status(500).json({ error: "Failed to set up the game" });
  }
};

const startGame = async (req, res) => {
  const { gameId } = req.params;
  let { username } = req.body;

  const validUsernameRegex = /^[A-Za-z0-9]+$/;
  if (!username || !validUsernameRegex.test(username)) {
    username = "default";
  }

  if (!gameId || isNaN(+gameId)) {
    return res.status(400).json({ error: "Game ID is required" });
  }

  // update start date and username
  try {
    const updatedGame = await prisma.game.update({
      where: { id: +gameId },
      data: {
        username,
        startDate: new Date(),
      },
    });

    res.status(201).json({
      message: "Game started",
    });
  } catch (error) {
    console.error("Error starting the game:", error);
    res.status(500).json({ error: "Failed to start the game" });
  }
};

const checkCharacter = async (req, res) => {
  const { gameId } = req.params;
  const { coordinates } = req.body;

  if (isNaN(+gameId)) {
    return res.status(400).json({ error: "Invalid game ID provided." });
  }

  try {
    // find the game
    const game = await prisma.game.findUnique({
      where: {
        id: +gameId,
      },
    });

    if (!game) {
      return res.status(404).json({ error: "Game does not exist." });
    }

    // fetch linked characters to the game
    const gameCharacters = await prisma.gameCharacter.findMany({
      where: {
        gameId: +gameId,
        found: false,
      },
      include: {
        character: true,
      },
    });

    // check coordinates
    let foundCharacterId = await checkCoordinates(gameCharacters, coordinates);

    // handle return response
    if (foundCharacterId) {
      const isGameComplete = await checkGameStatus(+gameId);

      if (isGameComplete) {
        return res
          .status(200)
          .json({ message: "Game complete!", characterId: foundCharacterId });
      } else {
        return res
          .status(200)
          .json({ message: "Character found!", characterId: foundCharacterId });
      }
    } else {
      return res
        .status(404)
        .json({ error: "Character not found in the provided coordinates." });
    }
  } catch (err) {
    console.error("Error checking character:", err);
    res.status(500).json({ error: "Failed to check character" });
  }
};

const checkCoordinates = async (chars, coordinates) => {
  for (const gameCharacter of chars) {
    const { character } = gameCharacter;

    if (
      coordinates.x >= character.minX &&
      coordinates.x <= character.maxX &&
      coordinates.y >= character.minY &&
      coordinates.y <= character.maxY
    ) {
      await prisma.gameCharacter.update({
        where: {
          id: gameCharacter.id,
        },
        data: {
          found: true,
        },
      });

      return character.id;
    }
  }

  return false;
};

const checkGameStatus = async (gameId) => {
  const remainingCharacters = await prisma.gameCharacter.count({
    where: {
      gameId,
      found: false,
    },
  });

  return remainingCharacters === 0;
};

const getHighScores = (req, res) => {
  res.send("High scores retrieved");
};

module.exports = {
  setUpGame,
  startGame,
  checkCharacter,
  getHighScores,
};
