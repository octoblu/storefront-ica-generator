function isJSON(str) {
  try {
    JSON.parse(str)
    return true
  } catch (error) {
    return false
  }
}

module.exports = { isJSON }
