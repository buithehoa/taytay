class Auth::SpotifyController < ApplicationController
  def callback
    spotify_user = RSpotify::User.new(request.env['omniauth.auth'])

    puts spotify_user.saved_albums.map(&:name)
  end
end
