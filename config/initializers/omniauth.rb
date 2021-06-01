require 'rspotify/oauth'

Rails.application.config.middleware.use OmniAuth::Builder do
  # TODO: Externalize credentials
  provider(
    :spotify,
    '2fab4ba642b846619622f92328704db3',
    '9873f5b2155948ab90feab471ceba287',
    scope: 'user-library-read user-library-modify'
  )
end
