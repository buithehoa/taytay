class UsersController < ApplicationController
  def spotify
    spotify_user = RSpotify::User.new(request.env['omniauth.auth'])

    puts spotify_user.inspect
  end
end
