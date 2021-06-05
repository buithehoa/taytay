class Auth::SpotifyController < ApplicationController
  def callback
    spotify_user = RSpotify::User.new(request.env['omniauth.auth'])

    puts spotify_user.display_name
    puts spotify_user.inspect
  end
end
